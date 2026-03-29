/**
 * Suppliers validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { SupplierType, CurrencyCode } from '$lib/shared/enums';
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
	OptionalUrlSchema
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
// SUPPLIER TREATMENT DEFAULTS
// ============================================================================

export const SupplierTreatmentQuerySchema = z.object({
	supplierId: z.uuid()
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
