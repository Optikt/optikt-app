/**
 * Purchase order validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { CoercedNumber, CoercedInteger, ListPaginationWithDeletedSchema } from './common';
import {
	PurchaseOrderItemType,
	PurchaseDocumentType,
	PurchaseDiscountType,
	PurchasePaymentTerms
} from '$lib/shared/enums';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
import {
	PurchaseOrderCreditTermsSchema,
	validatePurchaseOrderCreditTerms
} from './purchaseOrderCreditSchedule';

const ALL_ITEM_TYPES = Object.values(PurchaseOrderItemType) as [string, ...string[]];
const ALL_DOCUMENT_TYPES = Object.values(PurchaseDocumentType) as [string, ...string[]];
const ALL_DISCOUNT_TYPES = Object.values(PurchaseDiscountType) as [string, ...string[]];

const PurchaseOrderFinanceSchema = PurchaseOrderCreditTermsSchema;

// ============================================================================
// SETTLEMENT DISCOUNT
// ============================================================================

export const SettlementDiscountSchema = z
	.object({
		type: z.enum(ALL_DISCOUNT_TYPES).default(PurchaseDiscountType.NONE),
		value: CoercedNumber.min(0, 'Descuento no puede ser negativo').default(0),
		notes: z.string().trim().max(240).optional().nullable()
	})
	.superRefine((data, ctx) => {
		if (data.type === PurchaseDiscountType.NONE && data.value !== 0) {
			ctx.addIssue({
				code: 'custom',
				path: ['value'],
				message: 'Sin descuento debe tener valor 0'
			});
		}
		if (data.type === PurchaseDiscountType.PERCENT && data.value > 100) {
			ctx.addIssue({
				code: 'custom',
				path: ['value'],
				message: 'Porcentaje no puede superar 100'
			});
		}
	});

export const DEFAULT_SETTLEMENT_DISCOUNT = {
	type: PurchaseDiscountType.NONE,
	value: 0,
	notes: null as string | null
} as const;

// ============================================================================
// LIST / FILTER
// ============================================================================

export const ListPurchaseOrdersSchema = ListPaginationWithDeletedSchema.extend({
	search: z.string().trim().max(120).optional(),
	status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
	readyForReview: z.boolean().optional(),
	documentType: z.enum(ALL_DOCUMENT_TYPES).optional(),
	supplierId: z.uuid().optional(),
	hasPendingBalance: z.boolean().optional(),
	hasOverdueBalance: z.boolean().optional(),
	orderBy: z.enum(['orderNumber', 'orderDate', 'createdAt', 'status']).optional(),
	orderSort: z.enum(['asc', 'desc']).optional()
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
	unitPurchasePriceVes: CoercedNumber.min(0, 'Precio de compra en Bs debe ser ≥ 0').optional(),
	unitSalePrice: CoercedNumber.min(0, 'Precio de venta debe ser ≥ 0'),
	appliesIva: z.boolean().default(true),
	ivaRate: CoercedNumber.min(0).max(100).default(DEFAULT_TAX_RATE)
});

export const PurchaseOrderReviewableItemSchema = PurchaseOrderItemSchema.extend({
	isReviewed: z.boolean().optional(),
	isZeroPriceIntentional: z.boolean().optional()
});

export const PurchaseOrderDraftItemSchema = PurchaseOrderReviewableItemSchema.extend({
	id: z.uuid().optional()
});

// ============================================================================
// CREATE PO
// ============================================================================

export const CreatePurchaseOrderSchema = z
	.object({
		supplierId: z.uuid('Proveedor es obligatorio'),
		documentType: z.enum(ALL_DOCUMENT_TYPES, { message: 'Tipo de documento es obligatorio' }),
		invoiceNumber: z.string().optional(),
		deliveryNoteNumber: z.string().optional(),
		orderDate: z.iso.date('Fecha de orden inválida'),
		bcvRate: CoercedNumber.min(0, 'Tasa BCV debe ser ≥ 0'),
		pricesInVes: z.boolean().default(false),
		notes: z.string().min(6, 'Las observaciones deben tener al menos 6 caracteres'),
		discount: SettlementDiscountSchema.optional(),
		items: z.array(PurchaseOrderReviewableItemSchema).min(1, 'Debe incluir al menos un ítem')
	})
	.merge(PurchaseOrderFinanceSchema)
	.superRefine(validatePurchaseOrderCreditTerms);

// ============================================================================
// UPDATE PO (only DRAFT orders)
// ============================================================================

export const UpdatePurchaseOrderSchema = z.object({
	id: z.uuid(),
	supplierId: z.uuid().optional(),
	documentType: z.enum(ALL_DOCUMENT_TYPES).optional(),
	invoiceNumber: z.string().optional(),
	deliveryNoteNumber: z.string().optional(),
	orderDate: z.iso.date().optional(),
	bcvRate: CoercedNumber.min(0).optional(),
	pricesInVes: z.boolean().optional(),
	notes: z.string().min(6).optional(),
	discount: SettlementDiscountSchema.optional(),
	paymentTerms: z.enum(PurchasePaymentTerms).optional(),
	creditDueDate: z.iso.date().optional().nullable(),
	earlyPaymentDiscountPercent: CoercedNumber.min(0).max(100).optional().nullable(),
	earlyPaymentDiscountDeadline: z.iso.date().optional().nullable()
});

export const SavePurchaseOrderDraftSchema = z
	.object({
		id: z.uuid(),
		supplierId: z.uuid('Proveedor es obligatorio'),
		documentType: z.enum(ALL_DOCUMENT_TYPES, { message: 'Tipo de documento es obligatorio' }),
		invoiceNumber: z.string().optional(),
		deliveryNoteNumber: z.string().optional(),
		orderDate: z.iso.date('Fecha de orden inválida'),
		bcvRate: CoercedNumber.min(0, 'Tasa BCV debe ser ≥ 0'),
		pricesInVes: z.boolean().default(false),
		notes: z.string().min(6, 'Las observaciones deben tener al menos 6 caracteres'),
		discount: SettlementDiscountSchema.optional(),
		items: z.array(PurchaseOrderDraftItemSchema).min(1, 'Debe incluir al menos un ítem')
	})
	.merge(PurchaseOrderFinanceSchema)
	.superRefine(validatePurchaseOrderCreditTerms);

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

export const MarkPurchaseOrderReadySchema = z.object({
	id: z.uuid(),
	clearReviewed: z.boolean().default(false)
});

// ============================================================================
// TOGGLE PO ITEM REVIEWED
// ============================================================================

export const TogglePurchaseOrderItemReviewedSchema = z.object({
	id: z.uuid(),
	value: z.boolean()
});

// ============================================================================
// APPLY PRICE SUGGESTIONS (after PO confirm)
// ============================================================================

export const ApplyPriceSuggestionsSchema = z.object({
	updates: z
		.array(
			z.object({
				productId: z.uuid(),
				newSalePrice: CoercedNumber.min(0, 'Precio debe ser ≥ 0')
			})
		)
		.min(1, 'Debe incluir al menos una actualización')
});
