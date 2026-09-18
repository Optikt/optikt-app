import { toSaleTotalsLine, buildQuoteItemValues } from '$lib/remote/quotes/helpers';
import { findQuoteById, deleteQuoteItems } from '$lib/server/db/queries/quotes';
import { db } from '$lib/server/db';
import { quotes, quoteItems, quoteItemFreeDetails } from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
import { computeSaleTotals } from '$lib/shared/saleTotals';
import { auditService } from '$lib/server/audit';
import { eq } from 'drizzle-orm';
import { nowISO } from '$lib/dates';
import type { UpdateQuoteInput } from '$lib/schemas/quotes';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Update a quote (only DRAFT quotes can be edited).
 * Replaces all items.
 */
export async function updateExistingQuoteCore(data: UpdateQuoteInput, ctx: ActionContext) {
	const existing = await findQuoteById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Presupuesto no encontrado' };
	}
	if (existing.status !== QuoteStatus.DRAFT) {
		return { success: false as const, error: 'Solo se pueden editar presupuestos en borrador' };
	}

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

		// Update quote header
		const [updated] = await tx
			.update(quotes)
			.set({
				customerId: data.customerId !== undefined ? data.customerId : existing.customerId,
				subtotal,
				discount,
				discountType,
				snapshotTaxRate: data.snapshotTaxRate ?? existing.snapshotTaxRate,
				total,
				validUntil:
					data.validUntil !== undefined
						? data.validUntil
							? data.validUntil
							: null
						: existing.validUntil,
				notes: data.notes !== undefined ? data.notes : existing.notes,
				updatedAt: now
			})
			.where(eq(quotes.id, data.id))
			.returning();

		// Delete existing items and recreate (cascade deletes quoteItemFreeDetails)
		await deleteQuoteItems(data.id, tx);
		for (const item of data.items) {
			const quoteItemId = item.id ?? crypto.randomUUID();
			await tx
				.insert(quoteItems)
				.values(buildQuoteItemValues({ ...item, id: quoteItemId }, data.id, now));

			// For FREE_ITEM: insert the free details row
			if (item.itemType === SaleItemType.FREE_ITEM) {
				await tx.insert(quoteItemFreeDetails).values({
					id: crypto.randomUUID(),
					quoteItemId,
					category: item.freeItemCategory!,
					description: item.freeItemDescription!,
					enrichmentStatus: FreeItemEnrichmentStatus.PENDING,
					unitCost: item.freeItemUnitCost ?? null,
					supplierId: item.freeItemSupplierId ?? null,
					opticalNotes: item.freeItemOpticalNotes ?? null,
					createdAt: now,
					updatedAt: now
				});
			}
		}

		return updated;
	});

	// Audit log
	await auditService.logUpdate('quote', data.id, existing, quote, ctx, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const, quote };
}
