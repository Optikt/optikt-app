/**
 * Suppliers validation schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';
import { ALL_SUPPLIER_TYPES } from '$lib/shared/enums';

/** RIF validation schema - V/E/J/G-12345678-9 format */
const RifSchema = v.pipe(
	v.string(),
	v.regex(/^[VEJG]-\d{8}-\d$/, 'RIF inválido (formato: V/E/J/G-12345678-9)')
);

/** Phone validation - basic format */
const PhoneSchema = v.pipe(v.string(), v.minLength(7, 'Teléfono debe tener al menos 7 dígitos'));

export const ListSuppliersSchema = v.object({
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	perPage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 10),
	search: v.optional(v.string()),
	type: v.optional(v.picklist(ALL_SUPPLIER_TYPES)),
	includeDeleted: v.optional(v.boolean(), false)
});

export const CreateSupplierSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255)),
	type: v.picklist(ALL_SUPPLIER_TYPES, 'Tipo de proveedor requerido'),
	rif: v.optional(v.union([v.literal(''), RifSchema])),
	primaryPhone: PhoneSchema,
	email: v.optional(v.pipe(v.string(), v.email('Email inválido'))),
	address: v.optional(v.string()),
	instagram: v.optional(v.string()),
	whatsapp: v.optional(v.string()),
	website: v.optional(v.string()),
	contactName: v.optional(v.string()),
	contactPhone: v.optional(v.string()),
	contactRole: v.optional(v.string()),
	notes: v.optional(v.string())
});

export const UpdateSupplierSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255))),
	type: v.optional(v.picklist(ALL_SUPPLIER_TYPES)),
	rif: v.optional(v.union([v.literal(''), RifSchema])),
	primaryPhone: v.optional(PhoneSchema),
	email: v.optional(v.pipe(v.string(), v.email('Email inválido'))),
	address: v.optional(v.string()),
	instagram: v.optional(v.string()),
	whatsapp: v.optional(v.string()),
	website: v.optional(v.string()),
	contactName: v.optional(v.string()),
	contactPhone: v.optional(v.string()),
	contactRole: v.optional(v.string()),
	notes: v.optional(v.string())
});

export const SupplierIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid())
});
