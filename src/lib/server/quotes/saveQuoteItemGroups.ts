import { db } from '$lib/server/db';
import { findQuoteById } from '$lib/server/db/queries/quotes/reads';
import {
	findQuoteGroupableItems,
	findQuoteItemGroups,
	lockQuoteForGroups,
	replaceQuoteItemGroups
} from '$lib/server/db/queries/quotes/itemGroups';
import { auditService } from '$lib/server/audit';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { UserRole } from '$lib/shared/enums/roles';
import {
	normalizeGroupsForSubmit,
	summarizeGroups,
	validateItemGroups
} from '$lib/shared/saleItemGroups';
import type { SaveQuoteItemGroupsInput } from '$lib/schemas/quotes';
import type { ActionContext } from '$lib/server/actionContext';

class QuoteGroupsSaveError extends Error {}

/**
 * Groups-only save from the quote detail ("Organizar"). Blocked once the
 * quote left DRAFT (converted quotes carry their groups to the sale).
 */
export async function saveQuoteItemGroupsCore(data: SaveQuoteItemGroupsInput, ctx: ActionContext) {
	if (
		ctx.role !== UserRole.ADMIN &&
		ctx.role !== UserRole.MANAGER &&
		ctx.role !== UserRole.SELLER
	) {
		return { success: false as const, error: 'No tienes permisos para modificar este presupuesto' };
	}

	const quote = await findQuoteById(data.quoteId);
	if (!quote) return { success: false as const, error: 'Presupuesto no encontrado' };
	if (quote.status !== QuoteStatus.DRAFT) {
		return {
			success: false as const,
			error: 'Solo se pueden organizar presupuestos en borrador'
		};
	}

	let lines: Awaited<ReturnType<typeof findQuoteGroupableItems>> = [];
	let beforeGroups: Awaited<ReturnType<typeof findQuoteItemGroups>> = [];
	let groups: ReturnType<typeof normalizeGroupsForSubmit> = [];

	try {
		await db.transaction(async (tx) => {
			// Lock the quote row so concurrent conversions or item replacements serialize.
			const locked = await lockQuoteForGroups(data.quoteId, tx);
			if (!locked) throw new QuoteGroupsSaveError('Presupuesto no encontrado');
			if (locked.status !== QuoteStatus.DRAFT) {
				throw new QuoteGroupsSaveError('Solo se pueden organizar presupuestos en borrador');
			}

			[lines, beforeGroups] = await Promise.all([
				findQuoteGroupableItems(data.quoteId, tx),
				findQuoteItemGroups(data.quoteId, tx)
			]);
			const errors = validateItemGroups(data.groups, lines);
			if (errors.length > 0) throw new QuoteGroupsSaveError(errors[0]);

			groups = normalizeGroupsForSubmit(data.groups);
			await replaceQuoteItemGroups(data.quoteId, groups, tx);
		});
	} catch (error) {
		if (error instanceof QuoteGroupsSaveError) {
			return { success: false as const, error: error.message };
		}
		throw error;
	}

	const names = new Map(lines.map((l) => [l.id, l.snapshotName ?? 'Artículo']));
	const nameOf = (id: string) => names.get(id) ?? 'Artículo';
	const before = summarizeGroups(beforeGroups, nameOf);
	const after = summarizeGroups(groups, nameOf);
	if (before !== after) {
		await auditService.logCustom(
			'quote',
			data.quoteId,
			'update',
			{ personGroups: { old: before, new: after } },
			ctx
		);
	}

	return { success: true as const, groups };
}
