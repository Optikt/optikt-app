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
 * SALE_OUT and *REVERT movements: a sale edited twice must not re-return
 * the movements a prior edit already reverted (that inflated lot stock on
 * every edit/cancel round — see planSaleRevert).
 */
export async function revertSaleInventory(
	executor: DbOrTx,
	saleId: string,
	createdById: string,
	opts?: { origin?: 'edit' | 'cancel'; reason?: string }
): Promise<void> {
	const movementType =
		opts?.origin === 'edit'
			? InventoryMovementType.EDIT_REVERT
			: InventoryMovementType.CANCEL_REVERT;
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
					InventoryMovementType.CANCEL_REVERT,
					InventoryMovementType.EDIT_REVERT
				])
			)
		);

	for (const { lotId, productId, quantity } of planSaleRevert(movements)) {
		const updatedLot = await returnToLot(lotId, quantity, executor);

		await createInventoryMovement(
			{
				movementType,
				lotId,
				itemType: 'PRODUCT',
				productId: productId!,
				quantityDelta: quantity,
				quantityBefore: updatedLot.quantityAvailable - quantity,
				quantityAfter: updatedLot.quantityAvailable,
				referenceType: MovementReferenceType.SALE,
				referenceId: saleId,
				notes: opts?.origin === 'edit' && opts?.reason ? `Edición: ${opts.reason}` : null,
				createdById
			},
			executor
		);
	}
}
