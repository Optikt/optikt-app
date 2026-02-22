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
export const CoercedNumber = z.coerce.number<number | string>();

/**
 * CoercedInteger schema - accepts string or number, transforms to integer
 */
export const CoercedInteger = CoercedNumber.int();

/**
 * CoercedBoolean schema - accepts string or boolean, transforms to boolean
 * Handles form inputs like 'on', 'true', true
 */
export const CoercedBoolean = z.preprocess((val: boolean | string) => {
	if (typeof val === 'boolean') return val;
	if (val === 'on' || val === 'true') return true;
	if (val === 'off' || val === 'false') return false;
	return val;
}, z.boolean());

// =============================================================================
// NAME SCHEMAS
// =============================================================================

/**
 * Generic name validation for entities (brands, suppliers, etc.)
 */
export const NameSchema = (message = 'Nombre requerido') => z.string().min(1, message).max(100);

// =============================================================================
// EMAIL SCHEMAS
// =============================================================================

/**
 * Email validation - strict format
 */
export const EmailSchema = z.email('Email inválido').max(255);

/**
 * Optional email validation - allows empty string or valid email
 */
export const OptionalEmailSchema = z.union([z.literal(''), EmailSchema]);

// =============================================================================
// USERNAME & PASSWORD SCHEMAS
// =============================================================================

/**
 * Username validation - alphanumeric with underscores
 */
export const UsernameSchema = z
	.string()
	.min(3, 'Usuario debe tener al menos 3 caracteres')
	.max(50)
	.regex(/^[a-zA-Z0-9_]+$/, 'Usuario solo puede contener letras, números y guiones bajos');

/**
 * Password validation - standardized rules
 */
export const PasswordSchema = z
	.string()
	.min(8, 'La contraseña debe tener al menos 8 caracteres')
	.max(24, 'La contraseña debe tener máximo 24 caracteres');

/**
 * Optional password validation - allows empty (keep current) or valid password
 */
export const OptionalPasswordSchema = z.union([z.literal(''), PasswordSchema]);

// =============================================================================
// ID SCHEMAS
// =============================================================================

/**
 * Factory for entity ID schemas
 * @param entityName - Optional entity name for error message (e.g., "Marca" -> "Marca inválido")
 */
export const EntityIdSchema = (entityName?: string) =>
	z.object({ id: z.uuid(entityName ? `${entityName} inválido` : 'ID inválido') });

// =============================================================================
// PENDING ENTITY SCHEMAS
// =============================================================================

/**
 * Pending entity ID - UUID or pending_* string (for inline creation)
 */
export const PendingEntitySchema = (prefix = 'pending_') =>
	z.union([z.uuid(), z.string().startsWith(prefix)]);

/**
 * Optional pending entity ID - allows empty, UUID, or pending_* string
 */
export const OptionalPendingEntitySchema = (prefix = 'pending_') =>
	z.union([z.literal(''), PendingEntitySchema(prefix)]);

// =============================================================================
// DOMAIN-SPECIFIC SCHEMAS
// =============================================================================

/**
 * Refractive index validation for lenses
 */
export const RefractiveIndexSchema = CoercedNumber.min(1.0).max(2.0);

// =============================================================================
// OPTICAL VALUE SCHEMAS
// =============================================================================

/**
 * Sphere power validation - -30.00 to +30.00 diopters
 * Standard range for both prescriptions and lens catalog
 * Steps of 0.25 diopters
 */
export const SphereSchema = z.preprocess(
	(val: string | number) => {
		if (val === '' || val === undefined || val === null) return 0;
		return typeof val === 'string' ? parseFloat(val) : val;
	},
	z
		.number()
		.min(-30, 'Esfera debe ser mayor o igual a -30')
		.max(30, 'Esfera debe ser menor o igual a +30')
);

/**
 * Optional sphere schema for prescriptions
 */
export const OptionalSphereSchema = z.optional(SphereSchema);

/**
 * Cylinder power validation - -10.00 to 0.00 diopters (negative only)
 * In optical terms, cylinder is always expressed in negative form
 * Steps of 0.25 diopters
 */
export const CylinderSchema = z.preprocess(
	(val: string | number) => {
		if (val === '' || val === undefined || val === null) return 0;
		return typeof val === 'string' ? parseFloat(val) : val;
	},
	z
		.number()
		.min(-10, 'Cilindro debe ser mayor o igual a -10')
		.max(0, 'Cilindro debe ser negativo o cero')
);

/**
 * Optional cylinder schema for prescriptions
 */
export const OptionalCylinderSchema = z.optional(CylinderSchema);

/**
 * Addition power validation - 0.00 to +5.00 diopters
 * For progressive/bifocal lenses
 * Steps of 0.25 diopters
 */
export const AdditionSchema = z.preprocess((val: string | number) => {
	if (val === '' || val === undefined || val === null) return undefined;
	return typeof val === 'string' ? parseFloat(val) : val;
}, z.number().min(0, 'Adición debe ser mayor o igual a 0').max(5, 'Adición debe ser menor o igual a +5').optional());

/**
 * Optional addition schema for prescriptions
 */
export const OptionalAdditionSchema = z.optional(AdditionSchema);

// =============================================================================
// LIST PAGINATION SCHEMAS
// =============================================================================

/**
 * Standard pagination parameters for list endpoints
 */
export const ListPaginationSchema = z.object({
	page: z.int().min(1).default(1),
	perPage: z.int().min(1).max(100).default(10),
	search: z.string().optional()
});

/**
 * Pagination with soft-delete support
 */
export const ListPaginationWithDeletedSchema = ListPaginationSchema.extend({
	includeDeleted: z.boolean().default(false)
});

/**
 * Pagination with includeInactive flag (for users, products, etc.)
 */
export const ListPaginationWithInactiveSchema = ListPaginationSchema.extend({
	includeInactive: z.boolean().default(false)
});
