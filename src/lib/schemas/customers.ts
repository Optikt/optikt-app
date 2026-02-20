/**
 * Customers validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { PhoneSchema, OptionalIdNumberSchema } from './common';

export const ListCustomersSchema = z.object({
	page: z.int().min(1).default(1),
	perPage: z.int().min(1).max(100).default(10),
	search: z.string().optional()
});

export const CreateCustomerSchema = z.object({
	firstName: z.string().min(1, 'Nombre requerido').max(100),
	lastName: z.string().min(1, 'Apellido requerido').max(100),
	idNumber: OptionalIdNumberSchema,
	birthDate: z.iso.date('Fecha de nacimiento inválida'),
	primaryPhone: PhoneSchema,
	email: z.optional(z.union([z.literal(''), z.email('Email inválido')])),
	address: z.string().optional(),
	secondaryPhones: z.array(PhoneSchema).optional(),
	notes: z.string().optional()
});

export const UpdateCustomerSchema = z.object({
	id: z.uuid(),
	firstName: z.string().min(1, 'Nombre requerido').max(100).optional(),
	lastName: z.string().min(1, 'Apellido requerido').max(100).optional(),
	idNumber: OptionalIdNumberSchema,
	birthDate: z.iso.date('Fecha de nacimiento inválida').optional(),
	primaryPhone: PhoneSchema.optional(),
	email: z.optional(z.union([z.literal(''), z.email('Email inválido')])),
	address: z.string().optional(),
	secondaryPhones: z.array(PhoneSchema).optional(),
	notes: z.string().optional()
});

export const CustomerIdSchema = z.object({
	id: z.uuid()
});

export const ReactivateCustomerSchema = z.object({
	id: z.uuid(),
	firstName: z.string().min(1, 'Nombre requerido').max(100),
	lastName: z.string().min(1, 'Apellido requerido').max(100),
	idNumber: OptionalIdNumberSchema,
	birthDate: z.iso.date('Fecha de nacimiento inválida'),
	primaryPhone: PhoneSchema,
	email: z.optional(z.union([z.literal(''), z.email('Email inválido')])),
	address: z.string().optional(),
	secondaryPhones: z.array(PhoneSchema).optional(),
	notes: z.string().optional()
});
