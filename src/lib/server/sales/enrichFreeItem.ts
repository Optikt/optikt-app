import { db } from '$lib/server/db';
import { saleItems, saleItemFreeDetails } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
import { auditService } from '$lib/server/audit';
import { findSupplierById } from '$lib/server/db/queries/suppliers';
import { nowISO } from '$lib/dates';
import type { EnrichFreeItemInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Enrich or re-enrich a FREE_ITEM sale item with confirmed cost, supplier, and optical notes.
 * Moves enrichment_status from PENDING → ENRICHED, or overwrites an already-ENRICHED item.
 */
export async function enrichFreeItemCore(data: EnrichFreeItemInput, ctx: ActionContext) {
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
			enrichedById: ctx.userId!,
			updatedAt: now
		})
		.where(eq(saleItemFreeDetails.saleItemId, data.saleItemId))
		.returning();

	await auditService.logUpdate(
		'sale_item_free_details',
		freeDetailsRow.id,
		freeDetailsRow,
		updated,
		ctx,
		{
			excludeFields: ['createdAt', 'updatedAt']
		}
	);

	return { success: true as const, freeDetails: updated };
}
