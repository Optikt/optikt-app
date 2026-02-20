/**
 * Common/Shared validation schemas
 * Reusable Valibot schemas for use across multiple entity schemas
 */
import * as v from 'valibot';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { validateRif } from '$lib/utils';

// =============================================================================
// PHONE SCHEMAS
// =============================================================================

/**
 * Phone validation using libphonenumber-js
 * Validates phone numbers, defaulting to Venezuela (VE)
 */
export const PhoneSchema = v.pipe(
	v.string(),
	v.minLength(7, 'Teléfono debe tener al menos 7 dígitos'),
	v.check((value: string) => {
		if (!value) return true;
		const phone = parsePhoneNumberFromString(value, 'VE');
		return phone?.isValid() ?? false;
	}, 'Número de teléfono inválido')
);

/**
 * Optional phone validation - allows empty or valid phone
 */
export const OptionalPhoneSchema = v.optional(
	v.union([
		v.literal(''),
		v.pipe(
			v.string(),
			v.check((value: string) => {
				if (!value) return true;
				const phone = parsePhoneNumberFromString(value, 'VE');
				return phone?.isValid() ?? false;
			}, 'Número de teléfono inválido')
		)
	])
);

/**
 * WhatsApp validation - international format with country code
 * Format: +XXNNNNNNN
 */
export const WhatsAppSchema = v.optional(
	v.union([
		v.literal(''),
		v.pipe(
			v.string(),
			v.check((value: string) => {
				if (!value) return true;
				const phone = parsePhoneNumberFromString(value);
				return phone?.isValid() ?? false;
			}, 'Número de WhatsApp inválido')
		)
	])
);

// =============================================================================
// SOCIAL MEDIA SCHEMAS
// =============================================================================

/**
 * Instagram validation - should start with @
 */
export const InstagramSchema = v.optional(
	v.union([
		v.literal(''),
		v.pipe(v.string(), v.regex(/^@[\w.]+$/, 'Usuario de Instagram inválido'))
	])
);

// =============================================================================
// DOCUMENT SCHEMAS
// =============================================================================

/**
 * RIF validation schema - V/E/J/G-XXXXXXXX-X format
 * Uses Module 11 algorithm to validate check digit
 */
export const RifSchema = v.pipe(
	v.string(),
	v.regex(/^[VEJG]-\d{8}-\d$/, 'RIF inválido (formato: X-12345678-9)'),
	v.check((value: string) => validateRif(value), 'RIF inválido: dígito verificador incorrecto')
);

/**
 * Optional RIF validation
 */
export const OptionalRifSchema = v.optional(v.union([v.literal(''), RifSchema]));

/**
 * ID Number (Cédula) validation - V/E prefix with variable length digits
 * Format: V-123456 through V-12345678 or E-123456 through E-12345678
 */
export const IdNumberSchema = v.pipe(
	v.string(),
	v.regex(/^[VE]-\d{6,10}$/, 'Cédula inválida (formato: V-12345678 o E-12345678)')
);

/**
 * Optional ID Number validation
 */
export const OptionalIdNumberSchema = v.optional(v.union([v.literal(''), IdNumberSchema]));

/**
 * CoercedNumber schema - accepts string or number, transforms to number
 */
export const CoercedNumber = v.pipe(
	v.union([v.string(), v.number()]),
	v.transform((val) => (typeof val === 'string' ? parseFloat(val) : val)),
	v.number('Debe ser un número válido')
);

/**
 * CoercedInteger schema - accepts string or number, transforms to integer
 */
export const CoercedInteger = v.pipe(
	v.union([v.string(), v.number()]),
	v.transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val)),
	v.pipe(v.number(), v.integer())
);

/**
 * CoercedBoolean schema - accepts string or boolean, transforms to boolean
 */
export const CoercedBoolean = v.pipe(
	v.union([v.string(), v.boolean()]),
	v.transform((val) => {
		if (typeof val === 'boolean') return val;
		return val === 'on' || val === 'true';
	}),
	v.boolean()
);
