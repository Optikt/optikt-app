/**
 * Inventory adjustment validation schemas
 * Zod schemas for manual inventory adjustments and lot operations
 */
import { z } from 'zod';
import { CoercedInteger, ListPaginationSchema } from './common';
import { AdjustmentReason, InventoryMovementType } from '$lib/shared/enums';

// ============================================================================
// MANUAL ADJUSTMENT
// ============================================================================

export const ManualAdjustmentSchema = z
	.object({
		lotId: z.uuid('Seleccione un lote'),
		adjustmentType: z.enum(
			[InventoryMovementType.ADJUSTMENT_IN, InventoryMovementType.ADJUSTMENT_OUT],
			'Seleccione tipo de ajuste'
		),
		quantity: CoercedInteger.min(1, 'Cantidad debe ser al menos 1'),
		reason: z.enum(AdjustmentReason, 'Seleccione un motivo'),
		notes: z.string().min(10, 'El motivo debe tener al menos 10 caracteres')
	})
	.transform((data) => {
		// CUSTOMER_RETURN always forces ADJUSTMENT_IN
		if (data.reason === AdjustmentReason.CUSTOMER_RETURN) {
			return { ...data, adjustmentType: InventoryMovementType.ADJUSTMENT_IN };
		}
		return data;
	});

// ============================================================================
// LIST MOVEMENTS (for viewing movement history)
// ============================================================================

export const ListInventoryMovementsSchema = ListPaginationSchema.extend({
	lotId: z.uuid().optional(),
	productId: z.uuid().optional(),
	lensCatalogItemId: z.uuid().optional(),
	movementType: z.string().optional(),
	referenceType: z.string().optional(),
	dateFrom: z.iso.date().optional(),
	dateTo: z.iso.date().optional()
});

// ============================================================================
// LIST LOTS
// ============================================================================

export const ListInventoryLotsSchema = ListPaginationSchema.extend({
	productId: z.uuid().optional(),
	lensCatalogItemId: z.uuid().optional(),
	isActive: z.boolean().optional()
});

// ============================================================================
// REVERT FULL LOT (undo entire PO lot creation)
// ============================================================================

export const RevertLotSchema = z.object({
	lotId: z.uuid('Seleccione un lote')
});
