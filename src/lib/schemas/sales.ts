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
	DiscountType
} from '$lib/shared/enums';
import { AxisSchema } from '$lib/schemas/prescriptions';

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
// SALE ITEM SCHEMA
// ============================================================================

/**
 * A single line item in a sale.
 * Either productId or lensCatalogItemId must be provided (not both).
 */
export const SaleItemSchema = z
	.object({
		productId: z.uuid().optional(),
		lensCatalogItemId: z.uuid().optional(),
		selectedTreatments: z.array(z.string()).optional(),
		/** Link to existing prescription (optional, used for lens items) */
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
		notes: z.string().optional()
	})
	.refine((data) => data.productId || data.lensCatalogItemId, {
		message: 'Debe seleccionar un producto o un lente',
		path: ['productId']
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

export const AddPaymentSchema = z.object({
	saleId: z.uuid('ID de venta requerido'),
	paymentMethod: z.enum(ALL_PAYMENT_METHODS, 'Método de pago requerido'),
	/** Amount in the native currency of the payment method */
	amount: CoercedNumber.positive('El monto debe ser positivo'),
	/** Method-specific exchange rate (Bs per unit). Required for non-Bs methods */
	exchangeRate: CoercedNumber.positive().optional(),
	/** BCV official Bs/$ rate (always required) */
	bcvRate: CoercedNumber.positive('La tasa BCV es requerida'),
	reference: z.string().optional(),
	notes: z.string().optional()
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

export const CancelSaleSchema = z.object({
	id: z.uuid('ID de venta inválido'),
	reason: z.string().min(1, 'Motivo de cancelación requerido').optional()
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
export type CustomerLookupInput = z.infer<typeof CustomerLookupSchema>;
