import { and, eq, inArray } from 'drizzle-orm';
import { inventoryMovements } from '$lib/server/db/schema';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';
import { planSaleRevert } from '$lib/utils/inventory';
import { returnToLot } from '$lib/server/db/queries/inventoryLots';
import { createInventoryMovement } from '$lib/server/db/queries/inventoryMovements';
import type { DbOrTx } from '$lib/server/db/types';

/**
 * Return to the lots everything a sale still holds, inside the caller's tx.
 *
 * Used by both cancelSale and updateSale (which previously each inlined this
 * logic). The revert plan is the **net outstanding per lot** across the sale's
 * SALE_OUT and CANCEL_REVERT movements: a sale edited twice must not re-return
 * the movements a prior edit already reverted (that inflated lot stock on
 * every edit/cancel round — see planSaleRevert).
 */
export async function revertSaleInventory(
	executor: DbOrTx,
	saleId: string,
	createdById: string
): Promise<void> {
	const movements = await executor
		.select({
			lotId: inventoryMovements.lotId,
			productId: inventoryMovements.productId,
			movementType: inventoryMovements.movementType,
			quantityDelta: inventoryMovements.quantityDelta
		})
		.from(inventoryMovements)
		.where(
			and(
				eq(inventoryMovements.referenceType, MovementReferenceType.SALE),
				eq(inventoryMovements.referenceId, saleId),
				inArray(inventoryMovements.movementType, [
					InventoryMovementType.SALE_OUT,
					InventoryMovementType.CANCEL_REVERT
				])
			)
		);

	for (const { lotId, productId, quantity } of planSaleRevert(movements)) {
		const updatedLot = await returnToLot(lotId, quantity, executor);

		await createInventoryMovement(
			{
				movementType: InventoryMovementType.CANCEL_REVERT,
				lotId,
				itemType: 'PRODUCT',
				productId: productId!,
				quantityDelta: quantity,
				quantityBefore: updatedLot.quantityAvailable - quantity,
				quantityAfter: updatedLot.quantityAvailable,
				referenceType: MovementReferenceType.SALE,
				referenceId: saleId,
				createdById
			},
			executor
		);
	}
}
