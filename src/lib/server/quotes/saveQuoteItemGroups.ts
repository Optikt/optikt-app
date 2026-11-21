import { db } from '$lib/server/db';
import { findQuoteById } from '$lib/server/db/queries/quotes/reads';
import {
	findQuoteGroupableItems,
	findQuoteItemGroups,
	replaceQuoteItemGroups
} from '$lib/server/db/queries/quotes/itemGroups';
import { auditService } from '$lib/server/audit';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import {
	normalizeGroupsForSubmit,
	summarizeGroups,
	validateItemGroups
} from '$lib/shared/saleItemGroups';
import type { SaveQuoteItemGroupsInput } from '$lib/schemas/quotes';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Groups-only save from the quote detail ("Organizar"). Blocked once the
 * quote left DRAFT (converted quotes carry their groups to the sale).
 */
export async function saveQuoteItemGroupsCore(data: SaveQuoteItemGroupsInput, ctx: ActionContext) {
	const quote = await findQuoteById(data.quoteId);
	if (!quote) return { success: false as const, error: 'Presupuesto no encontrado' };
	if (quote.status !== QuoteStatus.DRAFT) {
		return {
			success: false as const,
			error: 'Solo se pueden organizar presupuestos en borrador'
		};
	}

	const lines = await findQuoteGroupableItems(data.quoteId);
	const errors = validateItemGroups(data.groups, lines);
	if (errors.length > 0) return { success: false as const, error: errors[0] };

	const beforeGroups = await findQuoteItemGroups(data.quoteId);
	const groups = normalizeGroupsForSubmit(data.groups);
	await db.transaction((tx) => replaceQuoteItemGroups(data.quoteId, groups, tx));

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
