import { toSaleTotalsLine, computeSaleTotals } from '$lib/shared/saleTotals';
import { findQuoteById, getQuoteItemsWithDetails } from '$lib/server/db/queries/quotes/reads';
import { deleteQuoteItems, updateQuote } from '$lib/server/db/queries/quotes/writes';
import { db } from '$lib/server/db';
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
export async function updateExistingQuoteCore(data: UpdateQuoteInput, ctx: ActionContext) {
	const existing = await findQuoteById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Presupuesto no encontrado' };
	}
	if (existing.status !== QuoteStatus.DRAFT) {
		return { success: false as const, error: 'Solo se pueden editar presupuestos en borrador' };
	}

	// Lectura de validación (fuera de la tx): ítems previos para el diff de auditoría.
	const beforeItems = await getQuoteItemsWithDetails(data.id);

	// Calculate totals from new items
	const discount = data.discount ?? existing.discount;
	const discountType = data.discountType ?? existing.discountType;
	const totals = computeSaleTotals(
		data.items.map((item) =>
			toSaleTotalsLine(item, data.snapshotTaxRate ?? existing.snapshotTaxRate)
		),
		discount,
		discountType
	);
	const subtotal = totals.subtotal;
	const total = totals.total;

	const quote = await db.transaction(async (tx) => {
		const now = nowISO();

		// Update quote header (query function con executor — sin Drizzle inline)
		const updated = await updateQuote(
			data.id,
			{
				customerId: data.customerId !== undefined ? data.customerId : existing.customerId,
				...(data.quoteDate !== undefined
					? { quoteDate: composeBusinessTimestamp(data.quoteDate) }
					: {}),
				subtotal,
				discount,
				discountType,
				snapshotTaxRate: data.snapshotTaxRate ?? existing.snapshotTaxRate,
				isCashea: data.isCashea ?? existing.isCashea,
				total,
				validUntil:
					data.validUntil !== undefined
						? data.validUntil
							? data.validUntil
							: null
						: existing.validUntil,
				notes: data.notes !== undefined ? data.notes : existing.notes,
				updatedAt: now
			},
			tx
		);

		// Delete existing items and recreate (cascade deletes quoteItemFreeDetails)
		await deleteQuoteItems(data.id, tx);
		await insertQuoteItems(tx, data.id, data.items, now);

		if (!updated) throw new Error('Presupuesto no encontrado al actualizar');
		return updated;
	});

	// Audit (best-effort, tras la tx): cambios de cabecera + diff de ítems.
	const headerChanges = calculateDiff(existing, quote, ['createdAt', 'updatedAt', 'deletedAt']);
	const toDiffItem = (item: SaleAuditItemLike & { parentQuoteItemId?: string | null }) => ({
		...item,
		parentSaleItemId: item.parentQuoteItemId ?? null
	});
	const itemsDiff = buildSaleAuditDiff(beforeItems.map(toDiffItem), data.items.map(toDiffItem), {
		dateLabel: 'Fecha',
		beforeHeader: {
			saleDate: existing.quoteDate,
			notes: existing.notes,
			isCashea: existing.isCashea,
			discount: existing.discount,
			discountType: existing.discountType
		},
		afterHeader: {
			saleDate: quote.quoteDate,
			notes: quote.notes,
			isCashea: quote.isCashea,
			discount: quote.discount,
			discountType: quote.discountType
		},
		beforeTotals: { subtotal: existing.subtotal, total: existing.total },
		afterTotals: { subtotal: quote.subtotal, total: quote.total }
	});
	const diffCount = countSaleAuditChanges(itemsDiff);
	if (hasChanges(headerChanges) || diffCount > 0) {
		await auditService.logCustom(
			'quote',
			data.id,
			'update',
			{ ...headerChanges, ...(diffCount > 0 ? { itemsDiff: { old: null, new: itemsDiff } } : {}) },
			ctx
		);
	}

	return { success: true as const, quote };
}
