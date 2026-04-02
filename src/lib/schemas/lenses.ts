/**
 * Lens validation schemas
 * Zod schemas for lens materials and catalog items
 */
import { z } from 'zod';
import { LensType, LensCatalogSource, LensPriceType, LensInventoryMode } from '$lib/shared/enums';
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
// OPTICAL RANGE (used inside catalog item schemas)
// ============================================================================

export const OpticalRangeSchema = z
	.object({
		sphereMin: SphereSchema,
		sphereMax: SphereSchema,
		cylinderMin: CylinderSchema.optional(),
		cylinderMax: CylinderSchema.optional(),
		additionMin: AdditionSchema.optional(),
		additionMax: AdditionSchema.optional()
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
// LENS CATALOG ITEMS (simplified)
// ============================================================================

/** JSON string → parsed array pipeline for ranges */
const RangesJsonSchema = z
	.string()
	.default('[]')
	.transform((val) => JSON.parse(val) as unknown[])
	.pipe(z.array(OpticalRangeSchema));

const BaseLensCatalogItemSchema = z.object({
	source: z.enum(LensCatalogSource).default(LensCatalogSource.LAB),
	supplierId: PendingEntitySchema(),
	name: NameSchema(),
	type: z.enum(LensType, 'Tipo de lente requerido'),
	technology: z.string().max(100).optional(),
	materialId: PendingEntitySchema('pending_material_'),
	pendingSupplierName: z.string().optional(),
	pendingMaterialName: z.string().optional(),
	pendingMaterialRefractiveIndex: RefractiveIndexSchema.optional(),
	ranges: RangesJsonSchema,

	// --- Inherent traits (booleans) ---
	hasAr: CoercedBoolean.default(false),
	hasBluecut: CoercedBoolean.default(false),
	isPhotochromic: CoercedBoolean.default(false),

	// --- Pricing ---
	priceType: z.enum(LensPriceType).default(LensPriceType.UNIT),
	basePrice: CoercedNumber.min(0, 'Precio de compra debe ser ≥ 0'),
	salePrice: CoercedNumber.min(0, 'Precio de venta debe ser ≥ 0').optional(),
	mountingPrice: CoercedNumber.min(0, 'Precio de montaje debe ser ≥ 0').default(0),
	shippingPrice: CoercedNumber.min(0, 'Precio de envío debe ser ≥ 0').default(0),

	// --- Tax ---
	isTaxable: CoercedBoolean.default(false),
	taxRate: CoercedNumber.min(0, 'Tasa de impuesto debe ser ≥ 0').default(16),

	// --- Inventory ---
	inventoryMode: z
		.enum(LensInventoryMode, 'Modo de inventario requerido')
		.default(LensInventoryMode.ON_DEMAND),
	stock: CoercedInteger.min(0).optional(),
	notes: z.string().optional()
});

export const CreateLensCatalogItemSchema = BaseLensCatalogItemSchema.refine(
	(data) => (data.source === LensCatalogSource.FINISHED ? data.ranges.length > 0 : true),
	{ message: 'Se requiere al menos un rango óptico para cristales terminados', path: ['ranges'] }
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
	type: z.enum(LensType).optional()
});

// Schema for lens-specific supplier operations (different from SupplierIdSchema in suppliers.ts)
export const LensSupplierIdSchema = z.object({
	supplierId: z.uuid()
});
