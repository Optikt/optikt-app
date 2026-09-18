import { resolveLensSnapshotCosts } from '$lib/remote/sales/helpers';
import { updateSaleItemCosts } from '$lib/server/db/queries/';
import { db } from '$lib/server/db';
import { saleItems } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { auditService } from '$lib/server/audit';
import type { UpdateSaleItemCostsInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

export async function updateItemCostsCore(data: UpdateSaleItemCostsInput, ctx: ActionContext) {
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

	await auditService.logUpdate('sale_item', data.saleItemId, existing, item, ctx, {
		excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
	});

	return { success: true as const };
}
