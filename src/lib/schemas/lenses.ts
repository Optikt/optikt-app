/**
 * Lens validation schemas
 * Zod schemas for lens materials, treatments, and catalog items
 */
import { z } from 'zod';
import { LensType, LensCatalogSource, LensPricingUnit } from '$lib/shared/enums';
import { PhotochromicMode, LensRangeAvailability, LensTreatmentAvailability, CORE_LENS_TREATMENT_CODES } from '$lib/shared/contracts';
import {
	CoercedBoolean,
	CoercedInteger,
	CoercedNumber,
	NameSchema,
	RefractiveIndexSchema,
	EntityIdSchema,
	PendingEntitySchema,
	SphereSchema,
	CylinderSchema,
	AdditionSchema
} from './common';

// ============================================================================
// LENS MATERIALS
// ============================================================================

export const CreateLensMaterialSchema = z.object({
	name: NameSchema(),
	code: z.string().min(1, 'Código requerido').max(50),
	refractiveIndex: RefractiveIndexSchema,
	description: z.string().optional()
});

export const UpdateLensMaterialSchema = CreateLensMaterialSchema.partial().extend({
	id: z.uuid(),
	isActive: z.boolean().optional()
});

// ============================================================================
// LENS TREATMENTS
// ============================================================================

export const CreateLensTreatmentSchema = z.object({
	name: NameSchema(),
	code: z.string().min(1, 'Código requerido').max(50),
	description: z.string().optional()
});

export const UpdateLensTreatmentSchema = CreateLensTreatmentSchema.partial().extend({
	id: z.uuid(),
	isActive: z.boolean().optional()
});

// ============================================================================
// OPTICAL RANGE (used inside catalog item schemas)
// ============================================================================

export const OpticalRangeSchema = z
	.object({
		sphereMin: SphereSchema,
		sphereMax: SphereSchema,
		cylinderMin: CylinderSchema.optional(),
		cylinderMax: CylinderSchema.optional(),
		additionMin: AdditionSchema.optional(),
		additionMax: AdditionSchema.optional(),
		mirrorGroup: z.uuid().optional()
	})
	.refine((data) => data.sphereMin <= data.sphereMax, {
		message: 'Esfera mínima debe ser ≤ esfera máxima',
		path: ['sphereMin']
	})
	.refine(
		(data) => {
			const hasMin = data.cylinderMin != null;
			const hasMax = data.cylinderMax != null;
			if (hasMin !== hasMax) return false;
			if (hasMin && hasMax) return data.cylinderMin! <= data.cylinderMax!;
			return true;
		},
		{ message: 'Cilindro mínimo debe ser ≤ cilindro máximo', path: ['cylinderMin'] }
	)
	.refine(
		(data) => {
			const hasMin = data.additionMin != null;
			const hasMax = data.additionMax != null;
			if (hasMin !== hasMax) return false;
			if (hasMin && hasMax) return data.additionMin! <= data.additionMax!;
			return true;
		},
		{ message: 'Adición mínima debe ser ≤ adición máxima', path: ['additionMin'] }
	);

export type OpticalRangeInput = z.infer<typeof OpticalRangeSchema>;

// ============================================================================
// TREATMENT POLICY (embedded in catalog item)
// ============================================================================

export const TreatmentPolicySchema = z.object({
	code: z.enum(CORE_LENS_TREATMENT_CODES),
	availability: z.enum(LensTreatmentAvailability),
	additionalPrice: CoercedNumber.min(0, 'Precio adicional debe ser ≥ 0').default(0),
	requiresConfirmation: CoercedBoolean.default(false)
});

export type TreatmentPolicyInput = z.infer<typeof TreatmentPolicySchema>;

// ============================================================================
// LENS CATALOG ITEMS
// ============================================================================

/** JSON string → parsed array pipeline for ranges */
const RangesJsonSchema = z
	.string()
	.default('[]')
	.transform((val) => JSON.parse(val) as unknown[])
	.pipe(z.array(OpticalRangeSchema));

/** JSON string → parsed array pipeline for treatment policies */
const TreatmentPoliciesJsonSchema = z
	.string()
	.default('[]')
	.transform((val) => JSON.parse(val) as unknown[])
	.pipe(z.array(TreatmentPolicySchema));

const BaseLensCatalogItemSchema = z.object({
	source: z.enum(LensCatalogSource).default(LensCatalogSource.LAB),
	supplierId: PendingEntitySchema(),
	name: NameSchema(),
	brand: z.string().optional(),
	technology: z.string().optional(),
	type: z.enum(LensType, 'Tipo de lente requerido'),
	materialId: PendingEntitySchema('pending_material_'),
	pendingSupplierName: z.string().optional(),
	pendingMaterialName: z.string().optional(),
	pendingMaterialRefractiveIndex: RefractiveIndexSchema.optional(),
	ranges: RangesJsonSchema,
	baseFeatures: z.array(z.string()).optional(),

	// --- Identity traits ---
	photochromicMode: z.enum(PhotochromicMode).default(PhotochromicMode.NONE),
	rangeAvailability: z.enum(LensRangeAvailability).default(LensRangeAvailability.EXACT_RANGES),

	// --- Treatment policies (JSON string from form) ---
	treatmentPolicies: TreatmentPoliciesJsonSchema,

	// --- Pricing ---
	pricingUnit: z.enum(LensPricingUnit).default(LensPricingUnit.UNIT),
	basePrice: CoercedNumber.min(0, 'Precio de compra debe ser ≥ 0'),
	suggestedMultiplier: CoercedNumber.min(1, 'Multiplicador debe ser ≥ 1').optional(),

	// --- Purchase policy ---
	allowsSingleUnitOrder: CoercedBoolean.default(false),
	singleUnitRequiresConfirmation: CoercedBoolean.default(false),
	singleUnitSurcharge: CoercedNumber.min(0).default(0),
	minimumOrderUnits: CoercedInteger.min(1).default(1),
	mountingPrice: CoercedNumber.min(0, 'Precio de montaje debe ser ≥ 0').default(0),
	shippingPrice: CoercedNumber.min(0, 'Precio de envío debe ser ≥ 0').default(0),

	// --- Operations ---
	deliveryDays: CoercedInteger.min(0).optional(),
	stock: CoercedInteger.min(0).optional(),
	refractiveIndex: RefractiveIndexSchema.optional(),
	notes: z.string().optional()
});

export const CreateLensCatalogItemSchema = BaseLensCatalogItemSchema.refine(
	(data) => data.rangeAvailability === 'CONSULT_REQUIRED' || data.ranges.length > 0,
	{ message: 'Se requiere al menos un rango óptico', path: ['ranges'] }
);

export const UpdateLensCatalogItemSchema = BaseLensCatalogItemSchema.partial().extend({
	id: z.uuid(),
	isActive: CoercedBoolean.optional()
});

// ============================================================================
// COMMON
// ============================================================================

export const LensIdSchema = EntityIdSchema();

export const ListLensCatalogSchema = z.object({
	search: z.string().optional(),
	source: z.enum(LensCatalogSource).optional(),
	supplierId: z.uuid().optional(),
	materialId: z.uuid().optional(),
	type: z.enum(LensType).optional(),
	technology: z.string().optional()
});

// Schema for lens-specific supplier operations (different from SupplierIdSchema in suppliers.ts)
export const LensSupplierIdSchema = z.object({
	supplierId: z.uuid()
});

export const UpsertSupplierTreatmentSchema = z.object({
	supplierId: z.uuid(),
	treatmentId: z.uuid(),
	price: CoercedNumber.min(0, 'Precio debe ser ≥ 0'),
	isAvailable: z.boolean().default(true)
});
