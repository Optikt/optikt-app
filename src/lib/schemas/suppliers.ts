/**
 * Suppliers validation schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';
import { ALL_SUPPLIER_TYPES } from '$lib/shared/enums';
import {
	PhoneSchema,
	OptionalPhoneSchema,
	WhatsAppSchema,
	InstagramSchema,
	OptionalRifSchema
} from './common';

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
	rif: OptionalRifSchema,
	primaryPhone: PhoneSchema,
	email: v.optional(v.union([v.literal(''), v.pipe(v.string(), v.email('Email inválido'))])),
	address: v.optional(v.string()),
	instagram: InstagramSchema,
	whatsapp: WhatsAppSchema,
	website: v.optional(v.string()),
	contactName: v.optional(v.string()),
	contactPhone: OptionalPhoneSchema,
	contactRole: v.optional(v.string()),
	notes: v.optional(v.string())
});

export const UpdateSupplierSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255))),
	type: v.optional(v.picklist(ALL_SUPPLIER_TYPES)),
	rif: OptionalRifSchema,
	primaryPhone: v.optional(PhoneSchema),
	email: v.optional(v.union([v.literal(''), v.pipe(v.string(), v.email('Email inválido'))])),
	address: v.optional(v.string()),
	instagram: InstagramSchema,
	whatsapp: WhatsAppSchema,
	website: v.optional(v.string()),
	contactName: v.optional(v.string()),
	contactPhone: OptionalPhoneSchema,
	contactRole: v.optional(v.string()),
	notes: v.optional(v.string())
});

export const SupplierIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid())
});

/**
 * Quick create schema - minimal fields for inline creation
 * Uses defaults for required fields, user can complete later
 */
export const QuickCreateSupplierSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255)),
	type: v.optional(v.picklist(ALL_SUPPLIER_TYPES)),
	primaryPhone: v.optional(v.string())
});
