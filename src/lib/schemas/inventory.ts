/**
 * Inventory adjustment validation schemas
 * Zod schemas for manual inventory adjustments
 */
import { z } from 'zod';
import { CoercedInteger, ListPaginationSchema } from './common';

// ============================================================================
// MANUAL ADJUSTMENT
// ============================================================================

export const ManualAdjustmentSchema = z.object({
	lotId: z.uuid('Lote es obligatorio'),
	quantityDelta: CoercedInteger.refine((v) => v !== 0, 'La cantidad no puede ser cero'),
	notes: z.string().min(1, 'El motivo del ajuste es obligatorio')
});

// ============================================================================
// LIST MOVEMENTS (for viewing movement history)
// ============================================================================

export const ListInventoryMovementsSchema = ListPaginationSchema.extend({
	lotId: z.uuid().optional(),
	productId: z.uuid().optional(),
	lensCatalogItemId: z.uuid().optional(),
	movementType: z.string().optional(),
	referenceType: z.string().optional()
});

// ============================================================================
// LIST LOTS
// ============================================================================

export const ListInventoryLotsSchema = ListPaginationSchema.extend({
	productId: z.uuid().optional(),
	lensCatalogItemId: z.uuid().optional(),
	isActive: z.boolean().optional()
});
