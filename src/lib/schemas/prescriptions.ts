/**
 * Prescriptions validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { LensType } from '$lib/shared/enums/lensTypes';
import {
	CoercedBoolean,
	EntityIdSchema,
	OptionalSphereSchema,
	OptionalCylinderSchema,
	OptionalAdditionSchema,
	OptionalCoercedInteger
} from './common';

function requireSphereOrCylinder<T extends Record<string, unknown>>(
	sphereKey: keyof T,
	cylinderKey: keyof T
) {
	return (data: T, ctx: z.RefinementCtx) => {
		// Check if value was explicitly provided (not undefined)
		// Explicit 0 is valid (patient has good vision) and will be normalized to null on save
		const hasSphere = data[sphereKey] !== undefined;
		const hasCylinder = data[cylinderKey] !== undefined;

		if (!(hasSphere || hasCylinder)) {
			ctx.addIssue({
				code: 'custom',
				message: 'Se necesita al menos Esfera o Cilindro',
				path: [sphereKey]
			});
			ctx.addIssue({
				code: 'custom',
				message: 'Se necesita al menos Esfera o Cilindro',
				path: [cylinderKey]
			});
		}
	};
}

function requireAxisWhenCylinder<T extends Record<string, unknown>>(
	cylinderKey: keyof T,
	axisKey: keyof T
) {
	return (data: T, ctx: z.RefinementCtx) => {
		// Check if cylinder was explicitly provided (not undefined)
		// This allows explicit 0 cylinder to not require axis
		const hasCylinder = data[cylinderKey] !== undefined && data[cylinderKey] !== 0; // Cylinder of 0 does not require axis
		const hasAxis = data[axisKey] !== undefined;

		if (hasCylinder && !hasAxis) {
			ctx.addIssue({
				code: 'custom',
				message: 'El eje es requerido cuando hay cilindro',
				path: [axisKey]
			});
		}
	};
}

// =============================================================================
// OPTICAL VALUE SCHEMAS (prescription-specific)
// =============================================================================

/**
 * Axis validation - 0 to 180 degrees, integers only
 * Always positive values in optical standards
 *
 * Uses z.preprocess to distinguish between:
 * - Empty string "" → undefined (no value provided by user)
 * - Intentional "0" → 0 (valid axis value)
 *
 * This is critical for requireAxisWhenCylinder validation to work correctly.
 */
export const AxisSchema = z.preprocess((val: number | string | undefined) => {
	// Empty string, null, or undefined → no value provided
	if (val === '' || val === null || val === undefined) {
		return undefined;
	}
	// Coerce to number for validation
	return typeof val === 'string' ? parseFloat(val) : val;
}, z.number().int('Eje debe ser un número entero').min(0, 'Eje debe ser mayor o igual a 0').max(180, 'Eje debe ser menor o igual a 180').optional());

/**
 * Distancia Pupilar (DP) validation - total pupillary distance
 * Typically ranges from 50 to 80mm, always positive
 * Uses OptionalCoercedInteger to distinguish empty string from intentional 0
 */
export const DpSchema = OptionalCoercedInteger({ min: 10, max: 80 });

/**
 * Nasopupilar (NP) validation - per-eye measurements
 * Always positive values, typically 10-40mm per eye
 * Uses OptionalCoercedInteger to distinguish empty string from intentional 0
 */
export const NpSchema = OptionalCoercedInteger({ min: 10, max: 80 });

/**
 * Altura (segment height) validation - for bifocal/progressive lenses
 * Ranges typically from 10 to 40mm, always positive
 * Uses OptionalCoercedInteger to distinguish empty string from intentional 0
 */
export const AlturaSchema = OptionalCoercedInteger({ min: 10, max: 40 });

// =============================================================================
// TREATMENTS SCHEMA
// =============================================================================

/**
 * Treatments that can be applied to a prescription
 * Using separate fields for form compatibility with SvelteKit
 */
export const TreatmentAntiReflectiveSchema = CoercedBoolean.optional();
export const TreatmentBlueBlockSchema = CoercedBoolean.optional();
export const TreatmentPhotochromicSchema = CoercedBoolean.optional();
export const TreatmentOtherSchema = z.string().optional();

// =============================================================================
// ID SCHEMAS
// =============================================================================

export const PrescriptionIdSchema = EntityIdSchema('Fórmula');
export const CustomerIdForPrescriptionSchema = z.object({
	customerId: z.uuid('ID de cliente inválido')
});

// =============================================================================
// PRESCRIPTION SCHEMAS
// =============================================================================

/**
 * Base prescription schema (shared between create and update)
 */
const PrescriptionBaseSchema = z.object({
	customerId: z.uuid('ID de cliente inválido'),
	prescriptionDate: z.iso.date('Fecha de fórmula inválida'),
	// Right eye (OD)
	odSphere: OptionalSphereSchema,
	odCylinder: OptionalCylinderSchema,
	odAxis: AxisSchema.optional(),
	odAddition: OptionalAdditionSchema,
	// Left eye (OS)
	osSphere: OptionalSphereSchema,
	osCylinder: OptionalCylinderSchema,
	osAxis: AxisSchema.optional(),
	osAddition: OptionalAdditionSchema,
	// Distancia Pupilar (DP) - total
	dp: DpSchema.optional(),
	// Nasopupilar (NP) - per-eye
	npRight: NpSchema.optional(),
	npLeft: NpSchema.optional(),
	// Altura (segment height) - for bifocal/progressive lenses
	altura: AlturaSchema.optional(),
	// Treatments (separate fields for form compatibility)
	treatmentAntiReflective: TreatmentAntiReflectiveSchema,
	treatmentBlueBlock: TreatmentBlueBlockSchema,
	treatmentPhotochromic: TreatmentPhotochromicSchema,
	treatmentOther: TreatmentOtherSchema,
	// Additional
	recommendedLensType: z.enum(LensType, 'Tipo de lente inválido').optional(),
	notes: z.string().optional(),
	doctorName: z.string().max(100).optional(),
	// Current prescription flag
	isCurrent: CoercedBoolean.optional()
});

/**
 * Prescription fields schema (without customerId)
 * Used to embed prescription data inside other schemas (e.g. customer creation)
 */
export const PrescriptionFieldsSchema = PrescriptionBaseSchema.omit({ customerId: true })
	.superRefine(requireSphereOrCylinder('osSphere', 'osCylinder'))
	.superRefine(requireSphereOrCylinder('odSphere', 'odCylinder'))
	.superRefine(requireAxisWhenCylinder('osCylinder', 'osAxis'))
	.superRefine(requireAxisWhenCylinder('odCylinder', 'odAxis'));

export type PrescriptionFieldsInput = z.infer<typeof PrescriptionFieldsSchema>;

/**
 * Create prescription schema
 * All optical values are optional but at least some should be provided
 */
export const CreatePrescriptionSchema = PrescriptionBaseSchema.superRefine(
	requireSphereOrCylinder('osSphere', 'osCylinder')
)
	.superRefine(requireSphereOrCylinder('odSphere', 'odCylinder'))
	.superRefine(requireAxisWhenCylinder('osCylinder', 'osAxis'))
	.superRefine(requireAxisWhenCylinder('odCylinder', 'odAxis'));

/**
 * Update prescription schema
 * All fields optional except id
 */
export const UpdatePrescriptionSchema = PrescriptionBaseSchema.partial()
	.extend({
		id: z.uuid('ID de fórmula inválido')
	})
	.superRefine(requireSphereOrCylinder('osSphere', 'osCylinder'))
	.superRefine(requireSphereOrCylinder('odSphere', 'odCylinder'))
	.superRefine(requireAxisWhenCylinder('osCylinder', 'osAxis'))
	.superRefine(requireAxisWhenCylinder('odCylinder', 'odAxis'));

/**
 * Set current prescription schema
 * Used to mark a prescription as the current one for a customer
 */
export const SetCurrentPrescriptionSchema = z.object({
	id: z.uuid('ID de fórmula inválido'),
	isCurrent: z.boolean()
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>;
export type UpdatePrescriptionInput = z.infer<typeof UpdatePrescriptionSchema>;
