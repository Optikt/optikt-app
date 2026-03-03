import { z } from 'zod';
import { PasswordSchema } from './common';

// ============================================================================
// LOGIN SCHEMA
// ============================================================================

export const loginSchema = z.object({
	identifier: z
		.string('Requerido')
		.min(4, 'Mínimo 4 caracteres')
		.max(255, 'Máximo 255 caracteres')
		.transform((s) => s.trim().toLowerCase()),
	password: PasswordSchema
});

export type LoginInput = z.infer<typeof loginSchema>;
