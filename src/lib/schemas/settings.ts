/**
 * Settings validation schemas
 * Zod schemas for business settings remote functions
 */
import { z } from 'zod';
import { validateRif } from '$lib/utils';

/**
 * Update business settings schema
 */
export const UpdateSettingsSchema = z.object({
	businessName: z.string().optional(),
	businessRif: z
		.union([
			z.literal(''),
			z
				.string()
				.regex(/^[VEJG]-\d{8}-\d$/, 'RIF inválido (formato: X-12345678-9)')
				.refine(
					(value: string) => validateRif(value),
					'RIF inválido: dígito verificador incorrecto'
				)
		])
		.optional(),
	businessPhone: z.string().optional(),
	businessEmail: z.union([z.literal(''), z.email('Email inválido')]).optional(),
	businessAddress: z.string().optional(),
	businessWebsite: z.string().optional(),
	businessLogo: z.string().optional()
});

/**
 * Update user profile schema
 * Uses fullName to match database column
 */
export const UpdateProfileSchema = z.object({
	fullName: z.string().min(1, 'Nombre requerido').max(255),
	email: z.email('Email inválido')
});

/**
 * Change password schema
 */
export const ChangePasswordSchema = z.object({
	currentPassword: z.string().min(1, 'Contraseña actual requerida'),
	newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
	confirmPassword: z.string().min(1, 'Confirme la nueva contraseña')
});
