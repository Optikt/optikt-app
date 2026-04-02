/**
 * Suppliers validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { SupplierType, CurrencyCode, ALL_TREATMENT_CATEGORIES } from '$lib/shared/enums';
import {
	PhoneSchema,
	OptionalPhoneSchema,
	WhatsAppSchema,
	InstagramSchema,
	OptionalRifSchema,
	NameSchema,
	OptionalEmailSchema,
	EntityIdSchema,
	ListPaginationSchema,
	OptionalUrlSchema,
	CoercedNumber,
	CoercedBoolean
} from './common';

export const ListSuppliersSchema = ListPaginationSchema.extend({
	type: z.enum(SupplierType).optional(),
	includeDeleted: z.boolean().default(false)
});

export const CreateSupplierSchema = z.object({
	name: NameSchema(),
	type: z.enum(SupplierType, 'Tipo de proveedor requerido'),
	rif: OptionalRifSchema,
	primaryPhone: PhoneSchema,
	email: OptionalEmailSchema,
	address: z.string().optional(),
	instagram: InstagramSchema,
	whatsapp: WhatsAppSchema,
	website: OptionalUrlSchema,
	contactName: z.string().optional(),
	contactPhone: OptionalPhoneSchema,
	contactRole: z.string().optional(),
	notes: z.string().optional(),
	defaultCurrency: z.enum(CurrencyCode).optional()
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial().extend({
	id: z.uuid()
});

export const SupplierIdSchema = EntityIdSchema();

export const ReactivateSupplierSchema = z.object({
	deletedSupplierId: z.uuid()
});

// ============================================================================
// SUPPLIER TREATMENTS
// ============================================================================

const ALL_TREATMENT_CATS = ALL_TREATMENT_CATEGORIES as [string, ...string[]];

export const SupplierTreatmentQuerySchema = z.object({
	supplierId: z.uuid()
});

export const CreateSupplierTreatmentSchema = z.object({
	supplierId: z.uuid(),
	name: z.string().min(1, 'Nombre requerido').max(100),
	category: z.enum(ALL_TREATMENT_CATS),
	price: CoercedNumber.min(0, 'Precio debe ser mayor o igual a 0'),
	salePrice: CoercedNumber.min(0, 'Precio de venta debe ser mayor o igual a 0').optional(),
	isTaxable: CoercedBoolean.default(true),
	taxRate: CoercedNumber.min(0, 'Tasa de impuesto debe ser mayor o igual a 0').default(16)
});

export const UpdateSupplierTreatmentSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1, 'Nombre requerido').max(100).optional(),
	category: z.enum(ALL_TREATMENT_CATS).optional(),
	price: CoercedNumber.min(0).optional(),
	salePrice: CoercedNumber.min(0).optional(),
	isTaxable: CoercedBoolean.optional(),
	taxRate: CoercedNumber.min(0).optional(),
	isActive: CoercedBoolean.optional()
});

export const SupplierTreatmentIdSchema = z.object({
	id: z.uuid()
});

/**
 * Quick create schema - minimal fields for inline creation
 * Uses defaults for required fields, user can complete later
 */
export const QuickCreateSupplierSchema = z.object({
	name: NameSchema(),
	type: z.enum(SupplierType).optional(),
	primaryPhone: PhoneSchema.optional()
});
