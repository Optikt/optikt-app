import * as v from 'valibot';

// ============================================================================
// LOGIN SCHEMA
// ============================================================================

export const loginSchema = v.object({
	identifier: v.pipe(
		v.string('Requerido'),
		v.minLength(4, 'Mínimo 4 caracteres'),
		v.maxLength(255, 'Máximo 255 caracteres'),
		v.transform((s) => s.trim().toLowerCase())
	),
	password: v.pipe(
		v.string('Requerido'),
		v.minLength(6, 'Mínimo 6 caracteres'),
		v.maxLength(24, 'Máximo 24 caracteres')
	)
});

export type LoginInput = v.InferOutput<typeof loginSchema>;
