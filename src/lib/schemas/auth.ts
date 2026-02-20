import { z } from 'zod';

// ============================================================================
// LOGIN SCHEMA
// ============================================================================

export const loginSchema = z.object({
	identifier: z
		.string('Requerido')
		.min(4, 'Mínimo 4 caracteres')
		.max(255, 'Máximo 255 caracteres')
		.transform((s) => s.trim().toLowerCase()),
	password: z.string('Requerido').min(6, 'Mínimo 6 caracteres').max(24, 'Máximo 24 caracteres')
});

export type LoginInput = z.infer<typeof loginSchema>;
