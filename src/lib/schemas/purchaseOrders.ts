/**
 * Purchase order validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { CoercedNumber, CoercedInteger, ListPaginationWithDeletedSchema } from './common';
import { PurchaseOrderItemType } from '$lib/shared/enums';

const ALL_ITEM_TYPES = Object.values(PurchaseOrderItemType) as [string, ...string[]];

// ============================================================================
// LIST / FILTER
// ============================================================================

export const ListPurchaseOrdersSchema = ListPaginationWithDeletedSchema.extend({
	status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
	supplierId: z.uuid().optional()
});

// ============================================================================
// PO ITEM
// ============================================================================

export const PurchaseOrderItemSchema = z.object({
	itemType: z.enum(ALL_ITEM_TYPES),
	productId: z.uuid().optional(),
	lensCatalogItemId: z.uuid().optional(),
	quantity: CoercedInteger.min(1, 'Cantidad debe ser al menos 1'),
	unitPurchasePrice: CoercedNumber.min(0, 'Precio de compra debe ser ≥ 0'),
	unitSalePrice: CoercedNumber.min(0, 'Precio de venta debe ser ≥ 0'),
	appliesIva: z.boolean().default(true),
	ivaRate: CoercedNumber.min(0).max(100).default(16)
});

// ============================================================================
// CREATE PO
// ============================================================================

export const CreatePurchaseOrderSchema = z.object({
	supplierId: z.uuid('Proveedor es obligatorio'),
	invoiceNumber: z.string().optional(),
	deliveryNoteNumber: z.string().optional(),
	orderDate: z.iso.datetime({ message: 'Fecha de orden inválida' }),
	bcvRate: CoercedNumber.min(0, 'Tasa BCV debe ser ≥ 0'),
	notes: z.string().optional(),
	items: z.array(PurchaseOrderItemSchema).min(1, 'Debe incluir al menos un ítem')
});

// ============================================================================
// UPDATE PO (only DRAFT orders)
// ============================================================================

export const UpdatePurchaseOrderSchema = z.object({
	id: z.uuid(),
	supplierId: z.uuid().optional(),
	invoiceNumber: z.string().optional(),
	deliveryNoteNumber: z.string().optional(),
	orderDate: z.iso.datetime().optional(),
	bcvRate: CoercedNumber.min(0).optional(),
	notes: z.string().optional()
});

// ============================================================================
// ADD ITEM TO EXISTING PO
// ============================================================================

export const AddPurchaseOrderItemSchema = PurchaseOrderItemSchema.extend({
	purchaseOrderId: z.uuid()
});

// ============================================================================
// CONFIRM PO
// ============================================================================

export const ConfirmPurchaseOrderSchema = z.object({
	id: z.uuid()
});

// ============================================================================
// CANCEL PO
// ============================================================================

export const CancelPurchaseOrderSchema = z.object({
	id: z.uuid()
});
