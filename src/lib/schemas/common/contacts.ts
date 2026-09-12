/**
 * Common contact schemas (phone, documents, social)
 * Split from schemas/common.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { validateRif, RIF_STRICT_RE, ID_NUMBER_STRICT_RE } from '$lib/utils';

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
	.regex(RIF_STRICT_RE, 'RIF inválido (formato: X-12345678-9)')
	.refine((value: string) => validateRif(value), 'RIF inválido: dígito verificador incorrecto');

/**
 * Optional RIF validation
 */
export const OptionalRifSchema = z.optional(z.union([z.literal(''), RifSchema]));

/**
 * ID Number (Cédula/RIF) validation - V/E/J/G prefix with variable length digits
 * Format: V-123456 through V-12345678, E-123456, J-12345678, G-12345678
 * Supports natural persons (V/E) and juridic/government entities (J/G)
 */
export const IdNumberSchema = z
	.string()
	.regex(
		ID_NUMBER_STRICT_RE,
		'Documento inválido (formato: V-12345678, E-12345678, J-12345678 o G-12345678)'
	);

/**
 * Optional ID Number validation
 */
export const OptionalIdNumberSchema = z.optional(z.union([z.literal(''), IdNumberSchema]));
