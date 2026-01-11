/**
 * Settings validation schemas
 * Valibot schemas for business settings remote functions
 */
import * as v from 'valibot';
import { validateRif } from '$lib/utils';

/**
 * Update business settings schema
 */
export const UpdateSettingsSchema = v.object({
	businessName: v.optional(v.string()),
	businessRif: v.optional(
		v.union([
			v.literal(''),
			v.pipe(
				v.string(),
				v.regex(/^[VEJG]-\d{8}-\d$/, 'RIF inválido (formato: X-12345678-9)'),
				v.check(
					(value: string) => validateRif(value),
					'RIF inválido: dígito verificador incorrecto'
				)
			)
		])
	),
	businessPhone: v.optional(v.string()),
	businessEmail: v.optional(
		v.union([v.literal(''), v.pipe(v.string(), v.email('Email inválido'))])
	),
	businessAddress: v.optional(v.string()),
	businessWebsite: v.optional(v.string()),
	businessLogo: v.optional(v.string())
});

/**
 * Update user profile schema
 * Uses fullName to match database column
 */
export const UpdateProfileSchema = v.object({
	fullName: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255)),
	email: v.pipe(v.string(), v.email('Email inválido'))
});

/**
 * Change password schema
 */
export const ChangePasswordSchema = v.object({
	currentPassword: v.pipe(v.string(), v.minLength(1, 'Contraseña actual requerida')),
	newPassword: v.pipe(
		v.string(),
		v.minLength(6, 'La nueva contraseña debe tener al menos 6 caracteres')
	),
	confirmPassword: v.pipe(v.string(), v.minLength(1, 'Confirme la nueva contraseña'))
});
