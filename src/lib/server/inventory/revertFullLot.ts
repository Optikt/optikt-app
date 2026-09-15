import { db } from '$lib/server/db';
import { findLotById } from '$lib/server/db/queries/inventoryLots';
import { findPurchaseOrderIdByLotId } from '$lib/server/db/queries/purchaseOrders/items';
import { createInventoryMovement } from '$lib/server/db/queries/inventoryMovements';
import { inventoryLots, products } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';
import { getErrorMessage } from '$lib/utils';
import { nowISO } from '$lib/dates';
import type { RevertLotInput } from '$lib/schemas/inventory';
import type { ActionContext } from '$lib/server/actionContext';

export async function revertFullLotCore(data: RevertLotInput, ctx: ActionContext) {
	const lot = await findLotById(data.lotId);
	if (!lot) {
		return { success: false as const, error: 'Lote no encontrado' };
	}

	const purchaseOrderId = await findPurchaseOrderIdByLotId(data.lotId);
	if (!purchaseOrderId) {
		return { success: false as const, error: 'No se pudo determinar la orden de compra del lote' };
	}

	// Can only revert if NO units have been consumed (sold, adjusted out, etc.)
	if (lot.quantityAvailable !== lot.quantityInitial) {
		return {
			success: false as const,
			error: `No se puede revertir: el lote tiene ${lot.quantityInitial - lot.quantityAvailable} unidades ya consumidas`
		};
	}

	const quantityDelta = -lot.quantityInitial;

	try {
		await db.transaction(async (tx) => {
			// 1. Zero out the lot
			await tx
				.update(inventoryLots)
				.set({
					quantityAvailable: 0,
					isActive: false,
					updatedAt: nowISO()
				})
				.where(eq(inventoryLots.id, data.lotId));

			// 2. Create ADJUSTMENT_OUT movement with ENTRY_ERROR reason
			await createInventoryMovement(
				{
					movementType: InventoryMovementType.ADJUSTMENT_OUT,
					lotId: data.lotId,
					itemType: lot.itemType,
					productId: lot.productId,
					lensCatalogItemId: lot.lensCatalogItemId,
					quantityDelta,
					quantityBefore: lot.quantityAvailable,
					quantityAfter: 0,
					referenceType: MovementReferenceType.PURCHASE_ORDER,
					referenceId: purchaseOrderId,
					notes: 'Reversión completa de lote',
					createdById: ctx.userId!
				},
				tx
			);

			// 3. Update cached stock on product
			if (lot.productId) {
				await tx
					.update(products)
					.set({
						stock: sql`${products.stock} + ${quantityDelta}`,
						updatedAt: nowISO()
					})
					.where(eq(products.id, lot.productId));
			}
		});

		return { success: true as const, lotId: data.lotId };
	} catch (e) {
		return { success: false as const, error: getErrorMessage(e) };
	}
}
