/**
 * Lens validation schemas
 * Zod schemas for lens materials, treatments, and catalog items
 */
import { z } from 'zod';
import { LensType, LensCatalogSource, LensPricingUnit } from '$lib/shared/enums';
import { CoercedBoolean, CoercedInteger, CoercedNumber } from './common';

// ============================================================================
// LENS MATERIALS
// ============================================================================

export const CreateLensMaterialSchema = z.object({
	name: z.string().min(1, 'Nombre requerido').max(255),
	code: z.string().min(1, 'Código requerido').max(50),
	refractiveIndex: CoercedNumber.min(1.0).max(2.0).optional(),
	description: z.string().optional()
});

export const UpdateLensMaterialSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1).max(255).optional(),
	code: z.string().min(1).max(50).optional(),
	refractiveIndex: CoercedNumber.min(1.0).max(2.0).optional(),
	description: z.string().optional(),
	isActive: z.boolean().optional()
});

// ============================================================================
// LENS TREATMENTS
// ============================================================================

export const CreateLensTreatmentSchema = z.object({
	name: z.string().min(1, 'Nombre requerido').max(255),
	code: z.string().min(1, 'Código requerido').max(50),
	description: z.string().optional()
});

export const UpdateLensTreatmentSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1).max(255).optional(),
	code: z.string().min(1).max(50).optional(),
	description: z.string().optional(),
	isActive: z.boolean().optional()
});

// ============================================================================
// OPTICAL RANGE (used inside catalog item schemas)
// ============================================================================

export const OpticalRangeSchema = z
	.object({
		sphereMin: CoercedNumber.min(-30).max(30),
		sphereMax: CoercedNumber.min(-30).max(30),
		cylinderMin: CoercedNumber.min(-10).max(0).optional(),
		cylinderMax: CoercedNumber.min(-10).max(0).optional(),
		additionMin: CoercedNumber.min(0).max(4.0).optional(),
		additionMax: CoercedNumber.min(0).max(4.0).optional(),
		mirrorGroup: z.uuid().optional()
	})
	.refine((data) => data.sphereMin <= data.sphereMax, {
		message: 'Esfera mínima debe ser ≤ esfera máxima',
		path: ['sphereMin']
	});

export type OpticalRangeInput = z.infer<typeof OpticalRangeSchema>;

// ============================================================================
// LENS CATALOG ITEMS
// ============================================================================

export const CreateLensCatalogItemSchema = z.object({
	source: z.enum(LensCatalogSource).default(LensCatalogSource.LAB),
	// supplierId accepts UUID or pending_* ID
	supplierId: z.union(
		[z.uuid(), z.string().startsWith('pending_')],
		'Proveedor requerido'
	),
	name: z.string().min(1, 'Nombre requerido').max(255),
	brand: z.string().optional(),
	technology: z.string().optional(),
	type: z.enum(LensType, 'Tipo de lente requerido'),
	// materialId accepts UUID or pending_material_* ID
	materialId: z.union(
		[z.uuid(), z.string().startsWith('pending_material_')],
		'Material requerido'
	),
	// Pending entity names (sent when ID starts with pending_*)
	pendingSupplierName: z.string().optional(),
	pendingMaterialName: z.string().optional(),
	pendingMaterialRefractiveIndex: CoercedNumber.min(1.0).max(2.0).optional(),
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
	refractiveIndex: CoercedNumber.min(1.0).max(2.0).optional(),
	notes: z.string().optional()
});

export const UpdateLensCatalogItemSchema = z.object({
	id: z.uuid(),
	source: z.enum(LensCatalogSource).optional(),
	supplierId: z.union([z.uuid(), z.string().startsWith('pending_')]).optional(),
	name: z.string().min(1).max(255).optional(),
	brand: z.string().optional(),
	technology: z.string().optional(),
	type: z.enum(LensType).optional(),
	materialId: z.union([z.uuid(), z.string().startsWith('pending_material_')]).optional(),
	// Pending entity names
	pendingSupplierName: z.string().optional(),
	pendingMaterialName: z.string().optional(),
	pendingMaterialRefractiveIndex: CoercedNumber.min(1.0).max(2.0).optional(),
	// Optical ranges — optional for partial update; if provided, replaces all
	ranges: z
		.string()
		.transform((val) => JSON.parse(val) as unknown[])
		.pipe(z.array(OpticalRangeSchema).min(1, 'Se requiere al menos un rango óptico'))
		.optional(),
	baseFeatures: z.array(z.string()).optional(),
	isPhotochromic: CoercedBoolean.optional(),
	isBlueCut: CoercedBoolean.optional(),
	isAR: CoercedBoolean.optional(),
	pricingUnit: z.enum(LensPricingUnit).optional(),
	basePrice: CoercedNumber.min(0).optional(),
	suggestedMultiplier: CoercedNumber.min(1).optional(),
	mountingPrice: CoercedNumber.min(0).optional(),
	deliveryDays: CoercedInteger.min(0).optional(),
	stock: CoercedInteger.min(0).optional(),
	refractiveIndex: CoercedNumber.min(1.0).max(2.0).optional(),
	notes: z.string().optional(),
	isActive: CoercedBoolean.optional()
});

// ============================================================================
// COMMON
// ============================================================================

export const LensIdSchema = z.object({
	id: z.uuid()
});

export const ListLensCatalogSchema = z.object({
	search: z.string().optional(),
	source: z.enum(LensCatalogSource).optional(),
	supplierId: z.uuid().optional(),
	materialId: z.uuid().optional(),
	type: z.enum(LensType).optional(),
	technology: z.string().optional()
});

export const SupplierIdSchema = z.object({
	supplierId: z.uuid()
});

export const UpsertSupplierTreatmentSchema = z.object({
	supplierId: z.uuid(),
	treatmentId: z.uuid(),
	price: CoercedNumber.min(0, 'Precio debe ser ≥ 0'),
	isAvailable: z.boolean().default(true)
});
