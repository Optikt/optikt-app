/**
 * Common identity schemas (names, auth, ids, pending entities)
 * Split from schemas/common.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { z } from 'zod';

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
