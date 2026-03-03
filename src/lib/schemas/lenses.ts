/**
 * Lens validation schemas
 * Zod schemas for lens materials, treatments, and catalog items
 */
import { z } from 'zod';
import { LensType, LensCatalogSource, LensPricingUnit } from '$lib/shared/enums';
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
// LENS CATALOG ITEMS
// ============================================================================

// TODO: Validation. If materialId is provided and starts with 'pending_material_',
// then pendingMaterialName and pendingMaterialRefractiveIndex are required.
// Similar for supplierId and pendingSupplierName. Also validate that if materialId
// is provided and does not start with 'pending_material_', it should be an uuid and
// the pendingMaterialName and pendingMaterialRefractiveIndex must not be provided (same for supplier).
export const CreateLensCatalogItemSchema = z.object({
	source: z.enum(LensCatalogSource).default(LensCatalogSource.LAB),
	// supplierId accepts UUID or pending_* ID
	supplierId: PendingEntitySchema('Proveedor requerido'),
	name: NameSchema(),
	brand: z.string().optional(),
	technology: z.string().optional(),
	type: z.enum(LensType, 'Tipo de lente requerido'),
	// materialId accepts UUID or pending_material_* ID
	materialId: PendingEntitySchema('pending_material_'),
	// Pending entity names (sent when ID starts with pending_*)
	pendingSupplierName: z.string().optional(),
	pendingMaterialName: z.string().optional(),
	pendingMaterialRefractiveIndex: RefractiveIndexSchema.optional(),
	// Optical ranges — at least one required
	ranges: z
		.string()
		.transform((val) => JSON.parse(val) as unknown[])
		.pipe(z.array(OpticalRangeSchema).min(1, 'Se requiere al menos un rango óptico')),
	baseFeatures: z.array(z.string()).optional(),
	isPhotochromic: CoercedBoolean.default(false),
	isBlueCut: CoercedBoolean.default(false),
	isAR: CoercedBoolean.default(false),
	pricingUnit: z.enum(LensPricingUnit).default(LensPricingUnit.UNIT),
	basePrice: CoercedNumber.min(0, 'Precio de compra debe ser ≥ 0'),
	suggestedMultiplier: CoercedNumber.min(1, 'Multiplicador debe ser ≥ 1').optional(),
	mountingPrice: CoercedNumber.min(0, 'Precio de montaje debe ser ≥ 0').optional(),
	deliveryDays: CoercedInteger.min(0).optional(),
	stock: CoercedInteger.min(0).optional(),
	refractiveIndex: RefractiveIndexSchema.optional(),
	notes: z.string().optional()
});

export const UpdateLensCatalogItemSchema = CreateLensCatalogItemSchema.partial().extend({
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
