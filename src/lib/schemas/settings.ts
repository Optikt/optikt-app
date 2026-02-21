/**
 * Settings validation schemas
 * Zod schemas for business settings remote functions
 */
import { z } from 'zod';
import { OptionalRifSchema, OptionalEmailSchema, NameSchema, PasswordSchema } from './common';

/**
 * Update business settings schema
 */
export const UpdateSettingsSchema = z.object({
	businessName: z.string().optional(),
	businessRif: OptionalRifSchema,
	businessPhone: z.string().optional(),
	businessEmail: OptionalEmailSchema,
	businessAddress: z.string().optional(),
	businessWebsite: z.string().optional(),
	businessLogo: z.string().optional()
});

/**
 * Update user profile schema
 * Uses fullName to match database column
 */
export const UpdateProfileSchema = z.object({
	fullName: NameSchema(),
	email: z.email('Email inválido')
});

/**
 * Change password schema
 */
export const ChangePasswordSchema = z.object({
	currentPassword: z.string().min(1, 'Contraseña actual requerida'),
	newPassword: PasswordSchema,
	confirmPassword: z.string().min(1, 'Confirme la nueva contraseña')
});
