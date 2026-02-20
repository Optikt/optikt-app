/**
 * Common/Shared validation schemas
 * Reusable Zod schemas for use across multiple entity schemas
 */
import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { validateRif } from '$lib/utils';

export const EmptySchema = z.object({});

// =============================================================================
// PHONE SCHEMAS
// =============================================================================

/**
 * Phone validation using libphonenumber-js
 * Validates phone numbers, defaulting to Venezuela (VE)
 */
export const PhoneSchema = z
	.string()
	.min(7, 'Teléfono debe tener al menos 7 dígitos')
	.refine((value: string) => {
		if (!value) return true;
		const phone = parsePhoneNumberFromString(value, 'VE');
		return phone?.isValid() ?? false;
	}, 'Número de teléfono inválido');

/**
 * Optional phone validation - allows empty or valid phone
 */
export const OptionalPhoneSchema = z.optional(
	z.union([
		z.literal(''),
		z.string().refine((value: string) => {
			if (!value) return true;
			const phone = parsePhoneNumberFromString(value, 'VE');
			return phone?.isValid() ?? false;
		}, 'Número de teléfono inválido')
	])
);

/**
 * WhatsApp validation - international format with country code
 * Format: +XXNNNNNNN
 */
export const WhatsAppSchema = z.optional(
	z.union([
		z.literal(''),
		z.string().refine((value: string) => {
			if (!value) return true;
			const phone = parsePhoneNumberFromString(value);
			return phone?.isValid() ?? false;
		}, 'Número de WhatsApp inválido')
	])
);

// =============================================================================
// SOCIAL MEDIA SCHEMAS
// =============================================================================

/**
 * Instagram validation - should start with @
 */
export const InstagramSchema = z.optional(
	z.union([z.literal(''), z.string().regex(/^@[\w.]+$/, 'Usuario de Instagram inválido')])
);

// =============================================================================
// DOCUMENT SCHEMAS
// =============================================================================

/**
 * RIF validation schema - V/E/J/G-XXXXXXXX-X format
 * Uses Module 11 algorithm to validate check digit
 */
export const RifSchema = z
	.string()
	.regex(/^[VEJG]-\d{8}-\d$/, 'RIF inválido (formato: X-12345678-9)')
	.refine((value: string) => validateRif(value), 'RIF inválido: dígito verificador incorrecto');

/**
 * Optional RIF validation
 */
export const OptionalRifSchema = z.optional(z.union([z.literal(''), RifSchema]));

/**
 * ID Number (Cédula) validation - V/E prefix with variable length digits
 * Format: V-123456 through V-12345678 or E-123456 through E-12345678
 */
export const IdNumberSchema = z
	.string()
	.regex(/^[VE]-\d{6,10}$/, 'Cédula inválida (formato: V-12345678 o E-12345678)');

/**
 * Optional ID Number validation
 */
export const OptionalIdNumberSchema = z.optional(z.union([z.literal(''), IdNumberSchema]));

/**
 * CoercedNumber schema - accepts string or number, transforms to number
 */
export const CoercedNumber = z.coerce.number<number>();

/**
 * CoercedInteger schema - accepts string or number, transforms to integer
 */
export const CoercedInteger = z.coerce.number().int();

/**
 * CoercedBoolean schema - accepts string or boolean, transforms to boolean
 * Handles form inputs like 'on', 'true', true
 */
export const CoercedBoolean = z.preprocess((val) => {
	if (typeof val === 'boolean') return val;
	if (val === 'on' || val === 'true') return true;
	if (val === 'off' || val === 'false') return false;
	return val;
}, z.boolean());
