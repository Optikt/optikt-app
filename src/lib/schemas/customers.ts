/**
 * Customers validation schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

/**
 * Phone validation using libphonenumber-js
 * Validates phone numbers, defaulting to Venezuela (VE)
 */
const PhoneSchema = v.pipe(
	v.string(),
	v.minLength(7, 'Teléfono debe tener al menos 7 dígitos'),
	v.check((value: string) => {
		if (!value) return true;
		const phone = parsePhoneNumberFromString(value, 'VE');
		return phone?.isValid() ?? false;
	}, 'Número de teléfono inválido')
);

/**
 * Optional ID number (cedula) validation
 * Allows V/E- prefix followed by numbers
 */
const IdNumberSchema = v.optional(
	v.union([
		v.literal(''),
		v.pipe(
			v.string(),
			v.regex(/^[VE]-?\d{5,10}$/, 'Cédula inválida (formato: V-12345678 o E-12345678)')
		)
	])
);

export const ListCustomersSchema = v.object({
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	perPage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 10),
	search: v.optional(v.string())
});

export const CreateCustomerSchema = v.object({
	firstName: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(100)),
	lastName: v.pipe(v.string(), v.minLength(1, 'Apellido requerido'), v.maxLength(100)),
	idNumber: IdNumberSchema,
	birthDate: v.optional(v.union([v.literal(''), v.pipe(v.string(), v.isoDate('Fecha inválida'))])),
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
	idNumber: IdNumberSchema,
	birthDate: v.optional(v.union([v.literal(''), v.pipe(v.string(), v.isoDate('Fecha inválida'))])),
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
	idNumber: IdNumberSchema,
	birthDate: v.optional(v.union([v.literal(''), v.pipe(v.string(), v.isoDate('Fecha inválida'))])),
	primaryPhone: PhoneSchema,
	email: v.optional(v.union([v.literal(''), v.pipe(v.string(), v.email('Email inválido'))])),
	address: v.optional(v.string()),
	secondaryPhones: v.optional(v.array(v.string())),
	notes: v.optional(v.string())
});
