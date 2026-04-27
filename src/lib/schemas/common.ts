/**
 * Common/Shared validation schemas
 * Reusable Zod schemas for use across multiple entity schemas
 */
import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { validateRif, RIF_STRICT_RE, ID_NUMBER_STRICT_RE } from '$lib/utils';
import { fromISODate, fromISO } from '$lib/dates';

export const EmptySchema = z.object({});

// =============================================================================
// DATE TRANSFORMERS (for data coming FROM the DB / API)
// =============================================================================

/**
 * Transform an ISO datetime string into a Date object.
 * Use for timestamptz columns (createdAt, updatedAt, etc.)
 */
export const isoToDate = z.iso.datetime().transform((s) => fromISO(s));

/**
 * Same as isoToDate but allows null values (optional/nullable date columns).
 */
export const isoToDateNullable = isoToDate.nullable();

/**
 * Transform a date-only string (YYYY-MM-DD) into a Date at local midnight.
 * Use for date-only columns (birthDate, prescriptionDate, effectiveDate, etc.)
 * and form date inputs. Avoids the UTC-midnight off-by-one bug.
 */
export const isoToLocalDate = z.iso.date().transform((s) => fromISODate(s)!);

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

/**
 * CoercedNumber schema - accepts string or number, transforms to number
 */
export const CoercedNumber = z.coerce.number<number | string>();

/**
 * CoercedInteger schema - accepts string or number, transforms to integer
 */
export const CoercedInteger = CoercedNumber.int();

interface OptionalCoercedNumberOptions {
	min?: number;
	max?: number;
	invalidMessage?: string;
	integerMessage?: string;
	minMessage?: string;
	maxMessage?: string;
}

function preprocessOptionalNumber(val: number | string | null | undefined) {
	if (val === '' || val === null || val === undefined) {
		return undefined;
	}

	if (typeof val === 'string' && val.trim() === '') {
		return undefined;
	}

	const num = typeof val === 'string' ? Number(val.trim()) : Number(val);
	return Number.isNaN(num) ? val : num;
}

/**
 * Factory for optional coerced integer schemas
 * Converts empty string, null, or undefined to undefined (no value provided)
 * This allows distinguishing between "user didn't enter anything" and "user entered 0"
 *
 * @param options - Optional min/max constraints
 * @returns A zod schema that outputs number | undefined
 *
 * @example
 * const DpSchema = OptionalCoercedInteger({ min: 10, max: 80 });
 * DpSchema.safeParse(''); // => undefined
 * DpSchema.safeParse('0'); // => 0
 */
export const OptionalCoercedInteger = (options?: OptionalCoercedNumberOptions) => {
	return z.preprocess(preprocessOptionalNumber, createOptionalIntegerSchema(options));
};

/**
 * Factory for optional coerced number schemas
 * Converts empty string, null, or undefined to undefined (no value provided)
 */
export const OptionalCoercedNumber = (options?: OptionalCoercedNumberOptions) => {
	return z.preprocess(preprocessOptionalNumber, createOptionalNumberSchema(options));
};

/**
 * Helper to create the integer schema with optional constraints
 */

function createOptionalNumberSchema(options?: OptionalCoercedNumberOptions) {
	let schema = z.number({ error: options?.invalidMessage ?? 'Debe ser un número válido' });

	if (options?.min !== undefined) {
		schema = schema.min(options.min, options.minMessage ?? `Debe ser mayor o igual a ${options.min}`);
	}
	if (options?.max !== undefined) {
		schema = schema.max(options.max, options.maxMessage ?? `Debe ser menor o igual a ${options.max}`);
	}

	return schema.optional();
}

/**
 * Helper to create the integer schema with optional constraints
 */
function createOptionalIntegerSchema(options?: OptionalCoercedNumberOptions) {
	let schema = z
		.number({
			error: options?.invalidMessage ?? options?.integerMessage ?? 'Debe ser un número entero válido'
		})
		.int(options?.integerMessage ?? options?.invalidMessage ?? 'Debe ser un número entero válido');

	if (options?.min !== undefined) {
		schema = schema.min(options.min, options.minMessage ?? `Debe ser mayor o igual a ${options.min}`);
	}
	if (options?.max !== undefined) {
		schema = schema.max(options.max, options.maxMessage ?? `Debe ser menor o igual a ${options.max}`);
	}

	return schema.optional();
}

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

export const OptionalUrlSchema = z.union([z.literal(''), z.url('URL inválida')]);

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

/**
 * Factory for reactivation schemas.
 * Reuses a consistent deleted-entity id field and optionally merges extra fields.
 */
export const ReactivateEntitySchema = <
	TFieldName extends string,
	TExtra extends z.ZodRawShape = Record<never, never>
>(
	deletedIdField: TFieldName,
	extraFields?: TExtra
) => {
	const shape = {
		[deletedIdField]: z.uuid('ID inválido')
	} as unknown as { [K in TFieldName]: z.ZodUUID };

	return z.object(shape).extend(extraFields ?? ({} as TExtra));
};

// =============================================================================
// PENDING ENTITY SCHEMAS
// =============================================================================

/**
 * Pending entity ID - UUID or pending_* string (for inline creation)
 */
export const PendingEntitySchema = (prefix = 'pending_', message?: string) =>
	z.union([z.uuid(), z.string().startsWith(prefix)], message ? { error: message } : {});

/**
 * Optional pending entity ID - allows empty, UUID, or pending_* string
 */
export const OptionalPendingEntitySchema = (prefix = 'pending_', message?: string) =>
	z.union([z.literal(''), PendingEntitySchema(prefix, message)]);

// =============================================================================
// DOMAIN-SPECIFIC SCHEMAS
// =============================================================================

/**
 * Refractive index validation for lenses
 */
export const RefractiveIndexSchema = CoercedNumber.min(1.0).max(2.0);

function isQuarterStep(value: number): boolean {
	return Math.round(value * 100) % 25 === 0;
}

// =============================================================================
// OPTICAL VALUE SCHEMAS
// =============================================================================

/**
 * Sphere power validation - -30.00 to +30.00 diopters
 * Standard range for both prescriptions and lens catalog
 * Steps of 0.25 diopters
 *
 * For prescriptions: Use OptionalSphereSchema which converts empty to undefined
 * For lens catalog: Use SphereSchema which converts empty to 0
 */
export const SphereSchema = z.preprocess(
	(val: string | number) => {
		if (val === '' || val === undefined || val === null) return 0;
		if (typeof val === 'string' && val.trim() === '') return 0;
		const parsed = typeof val === 'string' ? Number(val.trim()) : val;
		return Number.isNaN(parsed) ? val : parsed;
	},
	z
		.number({ error: 'Esfera debe ser un número válido' })
		.min(-30, 'Esfera debe ser mayor o igual a -30')
		.max(30, 'Esfera debe ser menor o igual a +30')
		.refine(isQuarterStep, 'Esfera debe avanzar en pasos de 0.25')
);

/**
 * Optional sphere schema for prescriptions
 * Converts empty string to undefined, allowing validation to distinguish
 * between "user didn't enter anything" and "user entered 0"
 */
export const OptionalSphereSchema = z.preprocess(
	(val: string | number) => {
		if (val === '' || val === undefined || val === null) return undefined;
		if (typeof val === 'string' && val.trim() === '') return undefined;
		const parsed = typeof val === 'string' ? Number(val.trim()) : val;
		return Number.isNaN(parsed) ? val : parsed;
	},
	z
		.number({ error: 'Esfera debe ser un número válido' })
		.min(-30, 'Esfera debe ser mayor o igual a -30')
		.max(30, 'Esfera debe ser menor o igual a +30')
		.refine(isQuarterStep, 'Esfera debe avanzar en pasos de 0.25')
		.optional()
);

/**
 * Cylinder power validation - -10.00 to 0.00 diopters (negative only)
 * In optical terms, cylinder is always expressed in negative form
 * Steps of 0.25 diopters
 *
 * For prescriptions: Use OptionalCylinderSchema which converts empty to undefined
 * For lens catalog: Use CylinderSchema which converts empty to 0
 */
export const CylinderSchema = z.preprocess(
	(val: string | number) => {
		if (val === '' || val === undefined || val === null) return 0;
		if (typeof val === 'string' && val.trim() === '') return 0;
		const parsed = typeof val === 'string' ? Number(val.trim()) : val;
		return Number.isNaN(parsed) ? val : parsed;
	},
	z
		.number({ error: 'Cilindro debe ser un número válido' })
		.min(-10, 'Cilindro debe ser mayor o igual a -10')
		.max(0, 'Cilindro debe ser negativo o cero')
		.refine(isQuarterStep, 'Cilindro debe avanzar en pasos de 0.25')
);

/**
 * Optional cylinder schema for prescriptions
 * Converts empty string to undefined, allowing validation to distinguish
 * between "user didn't enter anything" and "user entered 0"
 */
export const OptionalCylinderSchema = z.preprocess(
	(val: string | number) => {
		if (val === '' || val === undefined || val === null) return undefined;
		if (typeof val === 'string' && val.trim() === '') return undefined;
		const parsed = typeof val === 'string' ? Number(val.trim()) : val;
		return Number.isNaN(parsed) ? val : parsed;
	},
	z
		.number({ error: 'Cilindro debe ser un número válido' })
		.min(-10, 'Cilindro debe ser mayor o igual a -10')
		.max(0, 'Cilindro debe ser negativo o cero')
		.refine(isQuarterStep, 'Cilindro debe avanzar en pasos de 0.25')
		.optional()
);

/**
 * Addition power validation - 0.00 to +5.00 diopters
 * For progressive/bifocal lenses
 * Steps of 0.25 diopters
 */
export const AdditionSchema = z.preprocess(
	(val: string | number) => {
		if (val === '' || val === undefined || val === null) return undefined;
		if (typeof val === 'string' && val.trim() === '') return undefined;
		const parsed = typeof val === 'string' ? Number(val.trim()) : val;
		return Number.isNaN(parsed) ? val : parsed;
	},
	z
		.number({ error: 'Adición debe ser un número válido' })
		.min(0, 'Adición debe ser mayor o igual a 0')
		.max(5, 'Adición debe ser menor o igual a +5')
		.refine(isQuarterStep, 'Adición debe avanzar en pasos de 0.25')
		.optional()
);

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
