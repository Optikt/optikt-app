/**
 * Prescriptions validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { LensType } from '$lib/shared/enums/lensTypes';
import {
	CoercedBoolean,
	CoercedInteger,
	EntityIdSchema,
	OptionalSphereSchema,
	OptionalCylinderSchema,
	OptionalAdditionSchema
} from './common';

function requireSphereOrCylinder<T extends Record<string, unknown>>(
	sphereKey: keyof T,
	cylinderKey: keyof T
) {
	return (data: T, ctx: z.RefinementCtx) => {
		const hasSphere = data[sphereKey] !== undefined && data[sphereKey] !== 0;
		const hasCylinder = data[cylinderKey] !== undefined && data[cylinderKey] !== 0;

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
		const hasCylinder = data[cylinderKey] !== undefined && data[cylinderKey] !== 0;
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
 */
export const AxisSchema = CoercedInteger.min(0, 'Eje debe ser mayor o igual a 0').max(
	180,
	'Eje debe ser menor o igual a 180'
);

/**
 * Distancia Pupilar (DP) validation - total pupillary distance
 * Typically ranges from 50 to 80mm, always positive
 */
export const DpSchema = CoercedInteger.min(10, 'DP debe ser mayor o igual a 10mm').max(
	80,
	'DP debe ser menor o igual a 80mm'
);

/**
 * Nasopupilar (NP) validation - per-eye measurements
 * Always positive values, typically 10-40mm per eye
 */
export const NpSchema = CoercedInteger.min(10, 'NP debe ser mayor o igual a 10mm').max(
	80,
	'NP debe ser menor o igual a 80mm'
);

// =============================================================================
// TREATMENTS SCHEMA
// =============================================================================

/**
 * Treatments that can be applied to a prescription
 * Using separate fields for form compatibility with SvelteKit
 */
export const TreatmentAntiReflectiveSchema = z.boolean().optional();
export const TreatmentBlueBlockSchema = z.boolean().optional();
export const TreatmentPhotochromicSchema = z.boolean().optional();
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
