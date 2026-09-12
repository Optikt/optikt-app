/**
 * Sales remote — item commands
 * Split from sales.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { resolveLensSnapshotCosts } from './helpers';
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { UpdateSaleItemCostsSchema, EnrichFreeItemSchema } from '$lib/schemas/';
import { updateSaleItemCosts } from '$lib/server/db/queries/';

import { db } from '$lib/server/db';
import { saleItems, saleItemFreeDetails } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';

import { auditService, getAuditContext } from '$lib/server/audit';

import { findSupplierById } from '$lib/server/db/queries/suppliers';

import { nowISO } from '$lib/dates';

export const updateItemCosts = command(UpdateSaleItemCostsSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();

	// Fetch the existing item for audit comparison
	const [existing] = await db
		.select()
		.from(saleItems)
		.where(and(eq(saleItems.id, data.saleItemId), isNull(saleItems.deletedAt)));

	if (!existing) {
		return { success: false as const, error: 'Artículo de venta no encontrado' };
	}

	const lensSnapshotCosts = resolveLensSnapshotCosts({
		itemType: existing.itemType,
		quantity: existing.quantity,
		snapshotBaseCost: data.snapshotBaseCost,
		snapshotMountingPrice: data.snapshotMountingPrice,
		snapshotShippingPrice: data.snapshotShippingPrice,
		shippingCostPending: data.shippingCostPending
	});

	const item = await updateSaleItemCosts(data.saleItemId, {
		snapshotBaseCost: data.snapshotBaseCost,
		snapshotMountingPrice: data.snapshotMountingPrice,
		snapshotShippingPrice: data.shippingCostPending ? null : data.snapshotShippingPrice,
		snapshotCostTotal: lensSnapshotCosts.snapshotCostTotal ?? existing.snapshotCostTotal,
		snapshotCostUnit: lensSnapshotCosts.snapshotCostUnit ?? existing.snapshotCostUnit,
		shippingCostPending: data.shippingCostPending
	});

	if (!item) {
		return { success: false as const, error: 'Error al actualizar costos' };
	}

	await auditService.logUpdate('sale_item', data.saleItemId, existing, item, context, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const };
});

/**
 * Enrich or re-enrich a FREE_ITEM sale item with confirmed cost, supplier, and optical notes.
 * ADMIN and MANAGER can enrich (cost data is financial information).
 * Moves enrichment_status from PENDING → ENRICHED, or overwrites an already-ENRICHED item.
 */
export const enrichFreeItem = command(EnrichFreeItemSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();

	// Find the sale item (validates it exists and is FREE_ITEM)
	const [saleItemRow] = await db
		.select()
		.from(saleItems)
		.where(and(eq(saleItems.id, data.saleItemId), isNull(saleItems.deletedAt)));

	if (!saleItemRow) {
		return { success: false as const, error: 'Artículo de venta no encontrado' };
	}

	if (saleItemRow.itemType !== SaleItemType.FREE_ITEM) {
		return { success: false as const, error: 'El artículo no es de tipo ítem libre' };
	}

	// Find the free details row
	const [freeDetailsRow] = await db
		.select()
		.from(saleItemFreeDetails)
		.where(eq(saleItemFreeDetails.saleItemId, data.saleItemId));

	if (!freeDetailsRow) {
		return { success: false as const, error: 'Detalles del ítem libre no encontrados' };
	}

	// Validate supplier if provided
	if (data.supplierId) {
		const supplier = await findSupplierById(data.supplierId);
		if (!supplier) {
			return { success: false as const, error: 'Proveedor no encontrado' };
		}
	}

	const now = nowISO();

	const [updated] = await db
		.update(saleItemFreeDetails)
		.set({
			unitCost: data.unitCost,
			supplierId: data.supplierId ?? null,
			opticalNotes: data.opticalNotes ?? null,
			enrichmentStatus: FreeItemEnrichmentStatus.ENRICHED,
			enrichedAt: now,
			enrichedById: context.userId!,
			updatedAt: now
		})
		.where(eq(saleItemFreeDetails.saleItemId, data.saleItemId))
		.returning();

	await auditService.logUpdate(
		'sale_item_free_details',
		freeDetailsRow.id,
		freeDetailsRow,
		updated,
		context,
		{
			excludeFields: ['createdAt', 'updatedAt']
		}
	);

	return { success: true as const, freeDetails: updated };
});
