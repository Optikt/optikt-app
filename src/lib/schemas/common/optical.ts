/**
 * Common optical schemas (refractive index, sphere, cylinder, addition)
 * Split from schemas/common.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { z } from 'zod';
import { CoercedNumber } from './numbers';

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
