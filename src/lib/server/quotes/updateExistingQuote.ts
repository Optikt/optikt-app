import { toSaleTotalsLine, computeSaleTotals } from '$lib/shared/saleTotals';
import { findQuoteById, getQuoteItemsWithDetails } from '$lib/server/db/queries/quotes/reads';
import { deleteQuoteItems, updateQuote } from '$lib/server/db/queries/quotes/writes';
import { db } from '$lib/server/db';
import type { ChangeRecord } from '$lib/server/db/schema/changeHistory';
import {
	findQuoteItemGroups,
	lockQuoteForGroups,
	replaceQuoteItemGroups
} from '$lib/server/db/queries/quotes/itemGroups';
import {
	clampAllocations,
	dropEmptyGroups,
	groupsCanonicalSignature,
	normalizeGroupsForSubmit,
	summarizeGroups,
	validateItemGroups
} from '$lib/shared/saleItemGroups';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { auditService } from '$lib/server/audit';
import { calculateDiff, hasChanges } from '$lib/server/audit/utils';
import {
	buildSaleAuditDiff,
	countSaleAuditChanges,
	type SaleAuditItemLike
} from '$lib/server/sales/saleAuditDiff';
import { insertQuoteItems } from '$lib/server/quotes/quoteItemInsert';
import { composeBusinessTimestamp, nowISO } from '$lib/dates';
import type { UpdateQuoteInput } from '$lib/schemas/quotes';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Update a quote (only DRAFT quotes can be edited).
 * Replaces all items.
 *
 * D4: acepta `isCashea` (toggle del drawer). D3: `validUntil: null` = sin
 * vencimiento (la validez se calcula al leer; nunca se escribe EXPIRED).
 *
 * Auditoría: mismo formato que ventas — diff estructurado (`itemsDiff`:
 * artículos, datos, totales) anexado al evento de edición.
 */
class QuoteUpdateError extends Error {}

export async function updateExistingQuoteCore(data: UpdateQuoteInput, ctx: ActionContext) {
	const existing = await findQuoteById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Presupuesto no encontrado' };
	}
	if (existing.status !== QuoteStatus.DRAFT) {
		return { success: false as const, error: 'Solo se pueden editar presupuestos en borrador' };
	}

	const groupableItems = data.items
		.filter((item): item is typeof item & { id: string } => !!item.id)
		.map((item) => ({ id: item.id, itemType: item.itemType, quantity: item.quantity }));

	if (data.groups !== undefined) {
		const groupErrors = validateItemGroups(normalizeGroupsForSubmit(data.groups), groupableItems);
		if (groupErrors.length > 0) return { success: false as const, error: groupErrors[0] };
	}

	let beforeQuote = existing;
	let beforeItems: Awaited<ReturnType<typeof getQuoteItemsWithDetails>> = [];
	let beforeGroups: Awaited<ReturnType<typeof findQuoteItemGroups>> = [];
	let afterGroups: ReturnType<typeof normalizeGroupsForSubmit> = [];
	let quote: Awaited<ReturnType<typeof updateQuote>>;

	try {
		quote = await db.transaction(async (tx) => {
			// Serialize with concurrent saves/conversions and read pre-edit state inside the lock.
			const locked = await lockQuoteForGroups(data.id, tx);
			if (!locked) throw new QuoteUpdateError('Presupuesto no encontrado');
			if (locked.status !== QuoteStatus.DRAFT) {
				throw new QuoteUpdateError('Solo se pueden editar presupuestos en borrador');
			}

			const freshQuote = await findQuoteById(data.id, {}, tx);
			if (!freshQuote) throw new QuoteUpdateError('Presupuesto no encontrado');
			beforeQuote = freshQuote;

			[beforeItems, beforeGroups] = await Promise.all([
				getQuoteItemsWithDetails(data.id, tx),
				findQuoteItemGroups(data.id, tx)
			]);

			const discount = data.discount ?? freshQuote.discount;
			const discountType = data.discountType ?? freshQuote.discountType;
			const snapshotTaxRate = data.snapshotTaxRate ?? freshQuote.snapshotTaxRate;
			const totals = computeSaleTotals(
				data.items.map((item) => toSaleTotalsLine(item, snapshotTaxRate)),
				discount,
				discountType
			);

			const now = nowISO();

			// Update quote header (query function con executor — sin Drizzle inline)
			const updated = await updateQuote(
				data.id,
				{
					customerId: data.customerId !== undefined ? data.customerId : freshQuote.customerId,
					...(data.quoteDate !== undefined
						? { quoteDate: composeBusinessTimestamp(data.quoteDate) }
						: {}),
					subtotal: totals.subtotal,
					discount,
					discountType,
					snapshotTaxRate,
					isCashea: data.isCashea ?? freshQuote.isCashea,
					total: totals.total,
					validUntil:
						data.validUntil !== undefined
							? data.validUntil
								? data.validUntil
								: null
							: freshQuote.validUntil,
					notes: data.notes !== undefined ? data.notes : freshQuote.notes,
					updatedAt: now
				},
				tx
			);

			// Delete existing items and recreate (cascade deletes quoteItemFreeDetails)
			await deleteQuoteItems(data.id, tx);
			await insertQuoteItems(tx, data.id, data.items, now);

			// Preserving omitted groups clamps against the new items; explicit groups are validated above.
			afterGroups = normalizeGroupsForSubmit(
				data.groups !== undefined
					? data.groups
					: dropEmptyGroups(clampAllocations(beforeGroups, groupableItems))
			);
			await replaceQuoteItemGroups(data.id, afterGroups, tx);

			if (!updated) throw new QuoteUpdateError('Presupuesto no encontrado al actualizar');
			return updated;
		});
	} catch (error) {
		if (error instanceof QuoteUpdateError) {
			return { success: false as const, error: error.message };
		}
		throw error;
	}

	if (!quote) {
		return { success: false as const, error: 'Presupuesto no encontrado' };
	}

	// Audit (best-effort, tras la tx): cambios de cabecera + diff de ítems.
	const headerChanges = calculateDiff(beforeQuote, quote, ['createdAt', 'updatedAt', 'deletedAt']);
	const toDiffItem = (item: SaleAuditItemLike & { parentQuoteItemId?: string | null }) => ({
		...item,
		parentSaleItemId: item.parentQuoteItemId ?? null
	});
	const itemsDiff = buildSaleAuditDiff(beforeItems.map(toDiffItem), data.items.map(toDiffItem), {
		dateLabel: 'Fecha',
		beforeHeader: {
			saleDate: beforeQuote.quoteDate,
			notes: beforeQuote.notes,
			isCashea: beforeQuote.isCashea,
			discount: beforeQuote.discount,
			discountType: beforeQuote.discountType
		},
		afterHeader: {
			saleDate: quote.quoteDate,
			notes: quote.notes,
			isCashea: quote.isCashea,
			discount: quote.discount,
			discountType: quote.discountType
		},
		beforeTotals: { subtotal: beforeQuote.subtotal, total: beforeQuote.total },
		afterTotals: { subtotal: quote.subtotal, total: quote.total }
	});
	const diffCount = countSaleAuditChanges(itemsDiff);
	const nameOf = (id: string) => {
		const nextItem = data.items.find((i) => i.id === id);
		if (nextItem) return nextItem.snapshotName ?? nextItem.freeItemDescription ?? 'Artículo';
		const prevItem = beforeItems.find((i) => i.id === id);
		return prevItem?.snapshotName ?? prevItem?.freeDetails?.description ?? 'Artículo';
	};
	const groupsBefore = summarizeGroups(beforeGroups, nameOf);
	const groupsAfter = summarizeGroups(afterGroups, nameOf);
	const groupsStructChanged =
		groupsCanonicalSignature(normalizeGroupsForSubmit(beforeGroups)) !==
		groupsCanonicalSignature(afterGroups);
	const groupChanges: ChangeRecord =
		groupsBefore !== groupsAfter || groupsStructChanged
			? { personGroups: { old: groupsBefore, new: groupsAfter } }
			: {};
	if (hasChanges(headerChanges) || diffCount > 0 || hasChanges(groupChanges)) {
		await auditService.logCustom(
			'quote',
			data.id,
			'update',
			{
				...headerChanges,
				...groupChanges,
				...(diffCount > 0 ? { itemsDiff: { old: null, new: itemsDiff } } : {})
			},
			ctx
		);
	}

	return { success: true as const, quote };
}
