/**
 * Prescriptions validation schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';
import { LensType } from '$lib/shared/enums/lensTypes';

// =============================================================================
// OPTICAL VALUE SCHEMAS
// =============================================================================

/**
 * Sphere power validation - typically ranges from -20.00 to +20.00
 * In 0.25 increments
 */
export const SphereSchema = v.optional(
	v.pipe(
		v.number(),
		v.minValue(-20, 'Esfera debe ser mayor o igual a -20'),
		v.maxValue(20, 'Esfera debe ser menor o igual a +20')
	)
);

/**
 * Cylinder power validation - NEGATIVE ONLY (0 to -6)
 * In optical terms, cylinder is always expressed in negative form
 */
export const CylinderSchema = v.optional(
	v.pipe(
		v.number(),
		v.minValue(-6, 'Cilindro debe ser mayor o igual a -6'),
		v.maxValue(0, 'Cilindro debe ser negativo o cero')
	)
);

/**
 * Axis validation - 0 to 180 degrees, integers only
 * Always positive values in optical standards
 */
export const AxisSchema = v.optional(
	v.pipe(
		v.number(),
		v.integer('Eje debe ser un número entero'),
		v.minValue(0, 'Eje debe ser mayor o igual a 0'),
		v.maxValue(180, 'Eje debe ser menor o igual a 180')
	)
);

/**
 * Addition power validation - typically ranges from +0.50 to +4.00
 */
export const AdditionSchema = v.optional(
	v.pipe(
		v.number(),
		v.minValue(0.5, 'Adición debe ser mayor o igual a +0.50'),
		v.maxValue(4, 'Adición debe ser menor o igual a +4.00')
	)
);

/**
 * Distancia Pupilar (DP) validation - total pupillary distance
 * Typically ranges from 50 to 80mm, always positive
 */
export const DpSchema = v.optional(
	v.pipe(
		v.number(),
		v.minValue(20, 'DP debe ser mayor o igual a 20mm'),
		v.maxValue(80, 'DP debe ser menor o igual a 80mm')
	)
);

/**
 * Nasopupilar (NP) validation - per-eye measurements
 * Always positive values, typically 20-40mm per eye
 */
export const NpSchema = v.optional(
	v.pipe(
		v.number(),
		v.minValue(20, 'NP debe ser mayor o igual a 20mm'),
		v.maxValue(80, 'NP debe ser menor o igual a 80mm')
	)
);

// =============================================================================
// TREATMENTS SCHEMA
// =============================================================================

/**
 * Treatments that can be applied to a prescription
 * Using separate fields for form compatibility with SvelteKit
 */
export const TreatmentAntiReflectiveSchema = v.optional(v.boolean());
export const TreatmentBlueBlockSchema = v.optional(v.boolean());
export const TreatmentPhotochromicSchema = v.optional(v.boolean());
export const TreatmentOtherSchema = v.optional(v.string());

// =============================================================================
// ID SCHEMAS
// =============================================================================

export const PrescriptionIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid('ID de fórmula inválido'))
});

export const CustomerIdForPrescriptionSchema = v.object({
	customerId: v.pipe(v.string(), v.uuid('ID de cliente inválido'))
});

// =============================================================================
// PRESCRIPTION SCHEMAS
// =============================================================================

/**
 * Create prescription schema
 * All optical values are optional but at least some should be provided
 */
export const CreatePrescriptionSchema = v.object({
	customerId: v.pipe(v.string(), v.uuid('ID de cliente inválido')),
	prescriptionDate: v.pipe(v.string(), v.isoDate('Fecha de fórmula inválida')),
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
	recommendedLensType: v.optional(
		v.picklist(
			[LensType.MONOFOCAL, LensType.BIFOCAL, LensType.PROGRESSIVE, LensType.OCCUPATIONAL],
			'Tipo de lente inválido'
		)
	),
	notes: v.optional(v.string()),
	doctorName: v.optional(v.pipe(v.string(), v.maxLength(100))),
	// Current prescription flag
	isCurrent: v.optional(v.boolean())
});

/**
 * Update prescription schema
 * All fields optional except id
 */
export const UpdatePrescriptionSchema = v.object({
	id: v.pipe(v.string(), v.uuid('ID de fórmula inválido')),
	prescriptionDate: v.optional(v.pipe(v.string(), v.isoDate('Fecha de fórmula inválida'))),
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
	recommendedLensType: v.optional(
		v.picklist(
			[LensType.MONOFOCAL, LensType.BIFOCAL, LensType.PROGRESSIVE, LensType.OCCUPATIONAL],
			'Tipo de lente inválido'
		)
	),
	notes: v.optional(v.string()),
	doctorName: v.optional(v.pipe(v.string(), v.maxLength(100))),
	// Current prescription flag
	isCurrent: v.optional(v.boolean())
});

/**
 * Set current prescription schema
 * Used to mark a prescription as the current one for a customer
 */
export const SetCurrentPrescriptionSchema = v.object({
	id: v.pipe(v.string(), v.uuid('ID de fórmula inválido')),
	isCurrent: v.boolean()
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreatePrescriptionInput = v.InferInput<typeof CreatePrescriptionSchema>;
export type UpdatePrescriptionInput = v.InferInput<typeof UpdatePrescriptionSchema>;
