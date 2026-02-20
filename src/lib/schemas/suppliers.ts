/**
 * Suppliers validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { ALL_SUPPLIER_TYPES, ALL_CURRENCY_CODES } from '$lib/shared/enums';
import {
	PhoneSchema,
	OptionalPhoneSchema,
	WhatsAppSchema,
	InstagramSchema,
	OptionalRifSchema
} from './common';

export const ListSuppliersSchema = z.object({
	page: z.int().min(1).default(1),
	perPage: z.int().min(1).max(100).default(10),
	search: z.string().optional(),
	type: z.enum(ALL_SUPPLIER_TYPES).optional(),
	includeDeleted: z.boolean().default(false)
});

export const CreateSupplierSchema = z.object({
	name: z.string().min(1, 'Nombre requerido').max(255),
	type: z.enum(ALL_SUPPLIER_TYPES, 'Tipo de proveedor requerido'),
	rif: OptionalRifSchema,
	primaryPhone: PhoneSchema,
	email: z.union([z.literal(''), z.email('Email inválido')]).optional(),
	address: z.string().optional(),
	instagram: InstagramSchema,
	whatsapp: WhatsAppSchema,
	website: z.string().optional(),
	contactName: z.string().optional(),
	contactPhone: OptionalPhoneSchema,
	contactRole: z.string().optional(),
	notes: z.string().optional(),
	defaultCurrency: z.enum(ALL_CURRENCY_CODES).optional()
});

export const UpdateSupplierSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1, 'Nombre requerido').max(255).optional(),
	type: z.enum(ALL_SUPPLIER_TYPES).optional(),
	rif: OptionalRifSchema,
	primaryPhone: PhoneSchema.optional(),
	email: z.union([z.literal(''), z.email('Email inválido')]).optional(),
	address: z.string().optional(),
	instagram: InstagramSchema,
	whatsapp: WhatsAppSchema,
	website: z.string().optional(),
	contactName: z.string().optional(),
	contactPhone: OptionalPhoneSchema,
	contactRole: z.string().optional(),
	notes: z.string().optional(),
	defaultCurrency: z.enum(ALL_CURRENCY_CODES).optional()
});

export const SupplierIdSchema = z.object({
	id: z.uuid()
});

/**
 * Quick create schema - minimal fields for inline creation
 * Uses defaults for required fields, user can complete later
 */
export const QuickCreateSupplierSchema = z.object({
	name: z.string().min(1, 'Nombre requerido').max(255),
	type: z.enum(ALL_SUPPLIER_TYPES).optional(),
	primaryPhone: z.string().optional()
});
