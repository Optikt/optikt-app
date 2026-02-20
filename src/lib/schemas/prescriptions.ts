/**
 * Prescriptions validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { LensType } from '$lib/shared/enums/lensTypes';
import { CoercedInteger } from './common';

// =============================================================================
// OPTICAL VALUE SCHEMAS
// =============================================================================

/**
 * Sphere power validation - typically ranges from -20.00 to +20.00
 * In 0.25 increments
 */
export const SphereSchema = z.optional(
	z.preprocess(
		(val: string | number) => {
			if (val === '' || val === undefined || val === null) return 0;
			return typeof val === 'string' ? parseFloat(val) : val;
		},
		z
			.number()
			.min(-20, 'Esfera debe ser mayor o igual a -20')
			.max(20, 'Esfera debe ser menor o igual a +20')
	)
);

/**
 * Cylinder power validation - NEGATIVE ONLY (0 to -6)
 * In optical terms, cylinder is always expressed in negative form
 */
export const CylinderSchema = z.optional(
	z.preprocess(
		(val: string | number) => {
			if (val === '' || val === undefined || val === null) return 0;
			return typeof val === 'string' ? parseFloat(val) : val;
		},
		z
			.number()
			.min(-6, 'Cilindro debe ser mayor o igual a -6')
			.max(0, 'Cilindro debe ser negativo o cero')
	)
);

/**
 * Axis validation - 0 to 180 degrees, integers only
 * Always positive values in optical standards
 */
export const AxisSchema = CoercedInteger.min(0, 'Eje debe ser mayor o igual a 0').max(
	180,
	'Eje debe ser menor o igual a 180'
);

/**
 * Addition power validation - typically ranges from +0.50 to +4.00
 */
export const AdditionSchema = z.optional(
	z
		.number()
		.min(0.5, 'Adición debe ser mayor o igual a +0.50')
		.max(4, 'Adición debe ser menor o igual a +4.00')
);

/**
 * Distancia Pupilar (DP) validation - total pupillary distance
 * Typically ranges from 50 to 80mm, always positive
 */
export const DpSchema = z.optional(
	z.number().min(20, 'DP debe ser mayor o igual a 20mm').max(80, 'DP debe ser menor o igual a 80mm')
);

/**
 * Nasopupilar (NP) validation - per-eye measurements
 * Always positive values, typically 20-40mm per eye
 */
export const NpSchema = z.optional(
	z.number().min(20, 'NP debe ser mayor o igual a 20mm').max(80, 'NP debe ser menor o igual a 80mm')
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

export const PrescriptionIdSchema = z.object({
	id: z.uuid('ID de fórmula inválido')
});

export const CustomerIdForPrescriptionSchema = z.object({
	customerId: z.uuid('ID de cliente inválido')
});

// =============================================================================
// PRESCRIPTION SCHEMAS
// =============================================================================

/**
 * Create prescription schema
 * All optical values are optional but at least some should be provided
 */
export const CreatePrescriptionSchema = z.object({
	customerId: z.uuid('ID de cliente inválido'),
	prescriptionDate: z.iso.date('Fecha de fórmula inválida'),
	// Right eye (OD)
	odSphere: SphereSchema,
	odCylinder: CylinderSchema,
	odAxis: AxisSchema,
	odAddition: AdditionSchema,
	// Left eye (OS)
	osSphere: SphereSchema,
	osCylinder: CylinderSchema,
	osAxis: AxisSchema,
	osAddition: AdditionSchema,
	// Distancia Pupilar (DP) - total
	dp: DpSchema,
	// Nasopupilar (NP) - per-eye
	npRight: NpSchema,
	npLeft: NpSchema,
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
	isCurrent: z.boolean().optional()
});

/**
 * Update prescription schema
 * All fields optional except id
 */
export const UpdatePrescriptionSchema = z.object({
	id: z.uuid('ID de fórmula inválido'),
	prescriptionDate: z.iso.date('Fecha de fórmula inválida').optional(),
	// Right eye (OD)
	odSphere: SphereSchema,
	odCylinder: CylinderSchema,
	odAxis: AxisSchema,
	odAddition: AdditionSchema,
	// Left eye (OS)
	osSphere: SphereSchema,
	osCylinder: CylinderSchema,
	osAxis: AxisSchema,
	osAddition: AdditionSchema,
	// Distancia Pupilar (DP) - total
	dp: DpSchema,
	// Nasopupilar (NP) - per-eye
	npRight: NpSchema,
	npLeft: NpSchema,
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
	isCurrent: z.boolean().optional()
});

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
