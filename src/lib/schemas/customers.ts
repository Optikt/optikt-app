/**
 * Customers validation schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';
import { PhoneSchema, OptionalIdNumberSchema } from './common';

export const ListCustomersSchema = v.object({
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	perPage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 10),
	search: v.optional(v.string())
});

export const CreateCustomerSchema = v.object({
	firstName: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(100)),
	lastName: v.pipe(v.string(), v.minLength(1, 'Apellido requerido'), v.maxLength(100)),
	idNumber: OptionalIdNumberSchema,
	birthDate: v.pipe(v.string(), v.isoDate('Fecha de nacimiento inválida')),
	primaryPhone: PhoneSchema,
	email: v.optional(v.union([v.literal(''), v.pipe(v.string(), v.email('Email inválido'))])),
	address: v.optional(v.string()),
	secondaryPhones: v.optional(v.array(v.string())),
	notes: v.optional(v.string())
});

export const UpdateCustomerSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	firstName: v.optional(v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(100))),
	lastName: v.optional(v.pipe(v.string(), v.minLength(1, 'Apellido requerido'), v.maxLength(100))),
	idNumber: OptionalIdNumberSchema,
	birthDate: v.optional(v.pipe(v.string(), v.isoDate('Fecha de nacimiento inválida'))),
	primaryPhone: v.optional(PhoneSchema),
	email: v.optional(v.union([v.literal(''), v.pipe(v.string(), v.email('Email inválido'))])),
	address: v.optional(v.string()),
	secondaryPhones: v.optional(v.array(v.string())),
	notes: v.optional(v.string())
});

export const CustomerIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid())
});

export const ReactivateCustomerSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	firstName: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(100)),
	lastName: v.pipe(v.string(), v.minLength(1, 'Apellido requerido'), v.maxLength(100)),
	idNumber: OptionalIdNumberSchema,
	birthDate: v.pipe(v.string(), v.isoDate('Fecha de nacimiento inválida')),
	primaryPhone: PhoneSchema,
	email: v.optional(v.union([v.literal(''), v.pipe(v.string(), v.email('Email inválido'))])),
	address: v.optional(v.string()),
	secondaryPhones: v.optional(v.array(v.string())),
	notes: v.optional(v.string())
});
