/**
 * Sales validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import {
	CoercedNumber,
	CoercedInteger,
	EntityIdSchema,
	ListPaginationSchema,
	OptionalSphereSchema,
	OptionalCylinderSchema,
	OptionalAdditionSchema
} from './common';
import {
	ALL_SALE_STATUSES,
	ALL_PAYMENT_METHODS,
	ALL_DISCOUNT_TYPES,
	ALL_REFUND_STATUSES,
	DiscountType,
	RefundStatus
} from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { AxisSchema } from '$lib/schemas/prescriptions';

const ALL_SALE_ITEM_TYPES = Object.values(SaleItemType) as [string, ...string[]];

// ============================================================================
// LIST / FILTER SCHEMAS
// ============================================================================

export const ListSalesSchema = ListPaginationSchema.extend({
	status: z.enum(ALL_SALE_STATUSES).optional(),
	customerId: z.uuid().optional(),
	sellerId: z.uuid().optional(),
	dateFrom: z.iso.date().optional(),
	dateTo: z.iso.date().optional()
});

// ============================================================================
// PRESCRIPTION SNAPSHOT SCHEMA (reusable)
// ============================================================================

// ============================================================================
// SALE ITEM SCHEMA (redesigned — PRODUCT | LENS_PAIR | TREATMENT)
// ============================================================================

export const SaleItemSchema = z.object({
	/** Optional client-generated UUID — used to link treatment items to their parent lens item */
	id: z.uuid().optional(),
	itemType: z.enum(ALL_SALE_ITEM_TYPES),
	/** FK: only for PRODUCT items */
	productId: z.uuid().optional(),
	/** FK: only for LENS_PAIR items */
	lensCatalogItemId: z.uuid().optional(),
	/** FK self-ref: only for TREATMENT items → parent LENS_PAIR */
	parentSaleItemId: z.uuid().optional(),
	/** FK: only for TREATMENT items → which lab treatment */
	supplierTreatmentId: z.uuid().optional(),
	/** Link to existing prescription (optional, used for LENS_PAIR items) */
	prescriptionId: z.uuid().optional(),
	/** Prescription snapshot: right eye */
	odSphere: OptionalSphereSchema.optional(),
	odCylinder: OptionalCylinderSchema.optional(),
	odAxis: AxisSchema.optional(),
	odAddition: OptionalAdditionSchema.optional(),
	/** Prescription snapshot: left eye */
	osSphere: OptionalSphereSchema.optional(),
	osCylinder: OptionalCylinderSchema.optional(),
	osAxis: AxisSchema.optional(),
	osAddition: OptionalAdditionSchema.optional(),
	quantity: CoercedInteger.min(1, 'Cantidad debe ser al menos 1'),
	unitPrice: CoercedNumber.min(0, 'Precio debe ser mayor o igual a 0'),
	discount: CoercedNumber.min(0).default(0),
	discountType: z.enum(ALL_DISCOUNT_TYPES).default(DiscountType.FIXED),

	// Snapshot fields (immutable at time of sale)
	snapshotName: z.string().optional(),
	snapshotSku: z.string().optional(),
	snapshotBrand: z.string().optional(),
	snapshotBaseCost: CoercedNumber.optional(),
	snapshotMountingPrice: CoercedNumber.optional(),
	snapshotShippingPrice: CoercedNumber.optional(),
	snapshotSalePrice: CoercedNumber.optional(),
	snapshotPriceType: z.string().optional(),
	snapshotTreatmentCategory: z.string().optional(),

	// Tax snapshot
	snapshotIsTaxable: z.boolean().optional(),
	snapshotTaxRate: CoercedNumber.optional(),

	// Shipping cost pending flag
	shippingCostPending: z.boolean().optional(),

	notes: z.string().optional()
});

// ============================================================================
// CREATE SALE SCHEMA
// ============================================================================

/** Schema for inline customer creation during sale */
export const InlineCustomerSchema = z.object({
	firstName: z.string().min(1, 'Nombre requerido'),
	lastName: z.string().min(1, 'Apellido requerido'),
	idNumber: z.string().min(1, 'Documento requerido'),
	primaryPhone: z.string().optional(),
	email: z.string().email('Email inválido').optional().or(z.literal('')),
	address: z.string().optional(),
	notes: z.string().optional()
});

export const CreateSaleSchema = z
	.object({
		/** Existing customer ID (when customer found by cédula) */
		customerId: z.uuid().optional(),
		/** Inline customer data (when customer NOT found by cédula) */
		newCustomer: InlineCustomerSchema.optional(),
		saleDate: z.iso.date('Fecha de venta inválida'),
		discount: CoercedNumber.min(0).default(0),
		discountType: z.enum(ALL_DISCOUNT_TYPES).default(DiscountType.FIXED),
		notes: z.string().optional(),
		items: z.array(SaleItemSchema).min(1, 'La venta debe tener al menos un producto')
	})
	.refine((data) => data.customerId || data.newCustomer, {
		message: 'Debe seleccionar o crear un cliente',
		path: ['customerId']
	});

// ============================================================================
// PAYMENT SCHEMA
// ============================================================================

export const AddPaymentSchema = z
	.object({
		saleId: z.uuid('ID de venta requerido'),
		paymentMethod: z.enum(ALL_PAYMENT_METHODS, 'Método de pago requerido'),
		paymentDate: z.iso.date('La fecha del pago es requerida'),
		/** Amount in the native currency of the payment method */
		amount: CoercedNumber.positive('El monto debe ser positivo'),
		/** USD BCV equivalent entered by the user (avoids back-calculation rounding) */
		usdBcvAmount: CoercedNumber.positive('El monto USD BCV es requerido'),
		/** Method-specific exchange rate (Bs per unit). Required for non-Bs methods */
		exchangeRate: CoercedNumber.positive().optional(),
		/** BCV official Bs/$ rate (always required) */
		bcvRate: CoercedNumber.positive('La tasa BCV es requerida'),
		reference: z.string().optional(),
		notes: z.string().optional()
	})
	.superRefine((data, ctx) => {
		const isCashMethod =
			data.paymentMethod === 'EFECTIVO_BS' || data.paymentMethod === 'EFECTIVO_USD';

		if (!isCashMethod && !data.reference?.trim()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['reference'],
				message: 'La referencia es obligatoria para este método. Si no aplica, use --'
			});
		}
	});

export const VoidPaymentSchema = z.object({
	id: z.uuid('ID de pago requerido'),
	saleId: z.uuid('ID de venta requerido')
});

// ============================================================================
// UPDATE SALE STATUS SCHEMA
// ============================================================================

export const UpdateSaleStatusSchema = z.object({
	id: z.uuid('ID de venta inválido'),
	status: z.enum(ALL_SALE_STATUSES, 'Estado inválido')
});

// ============================================================================
// CANCEL SALE SCHEMA
// ============================================================================

export const CancelSaleSchema = z
	.object({
		id: z.uuid('ID de venta inválido'),
		reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
		refundStatus: z.enum(ALL_REFUND_STATUSES, 'Estado de reembolso inválido'),
		refundNotes: z.string().optional()
	})
	.superRefine((data, ctx) => {
		const needsRefundDetails =
			data.refundStatus === RefundStatus.REFUNDED || data.refundStatus === RefundStatus.RETAINED;

		if (needsRefundDetails) {
			if (!data.refundNotes || data.refundNotes.trim().length < 10) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['refundNotes'],
					message: 'La nota de reembolso debe tener al menos 10 caracteres'
				});
			}
		}
	});

// ============================================================================
// UPDATE SALE ITEM COSTS SCHEMA
// ============================================================================

export const UpdateSaleItemCostsSchema = z.object({
	saleItemId: z.uuid('ID de artículo requerido'),
	snapshotBaseCost: CoercedNumber.nonnegative().nullable(),
	snapshotMountingPrice: CoercedNumber.nonnegative().nullable(),
	snapshotShippingPrice: CoercedNumber.nonnegative().nullable(),
	shippingCostPending: z.boolean()
});

// ============================================================================
// ID SCHEMAS
// ============================================================================

export const SaleIdSchema = EntityIdSchema('Venta');

/** Search for a customer by document ID (cédula) */
export const CustomerLookupSchema = z.object({
	idNumber: z.string().min(1, 'Ingrese la cédula')
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;
export type SaleItemInput = z.infer<typeof SaleItemSchema>;
export type ListSalesInput = z.infer<typeof ListSalesSchema>;
export type InlineCustomerInput = z.infer<typeof InlineCustomerSchema>;
export type AddPaymentInput = z.infer<typeof AddPaymentSchema>;
export type VoidPaymentInput = z.infer<typeof VoidPaymentSchema>;
export type CancelSaleInput = z.infer<typeof CancelSaleSchema>;
export type CustomerLookupInput = z.infer<typeof CustomerLookupSchema>;
