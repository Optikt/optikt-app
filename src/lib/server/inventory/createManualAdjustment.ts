import { db } from '$lib/server/db';
import { findLotById } from '$lib/server/db/queries/inventoryLots';
import { createInventoryMovement } from '$lib/server/db/queries/inventoryMovements';
import { inventoryLots, products } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import {
	InventoryMovementType,
	MovementReferenceType,
	AdjustmentReason,
	ADJUSTMENT_REPORT_CATEGORIES
} from '$lib/shared/enums';
import { getErrorMessage } from '$lib/utils';
import { nowISO } from '$lib/dates';
import type { ManualAdjustmentInput } from '$lib/schemas/inventory';
import type { ActionContext } from '$lib/server/actionContext';

export async function createManualAdjustmentCore(data: ManualAdjustmentInput, ctx: ActionContext) {
	const { lotId, adjustmentType, quantity, reason, notes } = data;

	// Validate lot exists
	const lot = await findLotById(lotId);
	if (!lot) {
		return { success: false as const, error: 'Lote no encontrado' };
	}
	if (!lot.productId) {
		return { success: false as const, error: 'Solo se pueden ajustar lotes de productos' };
	}

	const isOutflow = adjustmentType === InventoryMovementType.ADJUSTMENT_OUT;
	const quantityDelta = isOutflow ? -quantity : quantity;

	// For ADJUSTMENT_OUT: check available stock
	if (isOutflow && quantity > lot.quantityAvailable) {
		return {
			success: false as const,
			error: `Stock insuficiente. Disponible: ${lot.quantityAvailable}, solicitado: ${quantity}`
		};
	}

	const quantityBefore = lot.quantityAvailable;
	const quantityAfter = quantityBefore + quantityDelta;

	// Cost tracking for ADJUSTMENT_OUT (real loss)
	const isCustomerReturn = reason === AdjustmentReason.CUSTOMER_RETURN;
	const unitCostAtAdjustment = isOutflow && !isCustomerReturn ? lot.unitPurchasePrice : null;
	const totalCostAtAdjustment =
		unitCostAtAdjustment != null ? unitCostAtAdjustment * quantity : null;
	const adjustmentReportCategory = isOutflow
		? ADJUSTMENT_REPORT_CATEGORIES[reason]
		: isCustomerReturn
			? ADJUSTMENT_REPORT_CATEGORIES[AdjustmentReason.CUSTOMER_RETURN]
			: null;

	const formattedNotes = `${reason}: ${notes}`;

	try {
		const result = await db.transaction(async (tx) => {
			// 1. Update lot quantity
			await tx
				.update(inventoryLots)
				.set({
					quantityAvailable: quantityAfter,
					isActive: quantityAfter > 0,
					updatedAt: nowISO()
				})
				.where(eq(inventoryLots.id, lotId));

			// 2. Create immutable movement record
			const movement = await createInventoryMovement(
				{
					movementType: adjustmentType,
					lotId,
					itemType: lot.itemType,
					productId: lot.productId,
					lensCatalogItemId: lot.lensCatalogItemId,
					quantityDelta,
					quantityBefore,
					quantityAfter,
					referenceType: MovementReferenceType.MANUAL_ADJUSTMENT,
					referenceId: lotId,
					notes: formattedNotes,
					unitCostAtAdjustment,
					totalCostAtAdjustment,
					adjustmentReportCategory,
					createdById: ctx.userId!
				},
				tx
			);

			// 3. Update cached stock on product
			await tx
				.update(products)
				.set({
					stock: sql`${products.stock} + ${quantityDelta}`,
					updatedAt: nowISO()
				})
				.where(eq(products.id, lot.productId!));

			return { movement, newStock: quantityAfter };
		});

		return {
			success: true as const,
			lotId,
			productId: lot.productId,
			newQuantityAvailable: result.newStock,
			movementId: result.movement.id
		};
	} catch (e) {
		return { success: false as const, error: getErrorMessage(e) };
	}
}
