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
// LENS TECHNOLOGIES
// ============================================================================

export const CreateLensTechnologySchema = z.object({
	supplierId: z.uuid('Seleccione un proveedor'),
	name: NameSchema(),
	minFittingHeight: CoercedNumber.min(0, 'Altura mínima debe ser ≥ 0').optional()
});

export const UpdateLensTechnologySchema = CreateLensTechnologySchema.partial().extend({
	id: z.uuid(),
	isActive: z.boolean().optional()
});

export type CreateLensTechnologyInput = z.infer<typeof CreateLensTechnologySchema>;
export type UpdateLensTechnologyInput = z.infer<typeof UpdateLensTechnologySchema>;

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

/**
 * JSON string → parsed string[] pipeline for array fields (differentiators, colors).
 * Accepts both a raw JSON string from a form submission and a pre-parsed array
 * (when used programmatically).
 */
const StringArraySchema = z
	.union([
		z
			.string()
			.transform((val) => {
				try {
					return JSON.parse(val) as unknown;
				} catch {
					return [];
				}
			})
			.pipe(z.array(z.string())),
		z.array(z.string())
	])
	.default([]);

const BaseLensCatalogItemSchema = z.object({
	source: z.enum(LensCatalogSource).default(LensCatalogSource.LAB),
	supplierId: PendingEntitySchema('pending_', 'Seleccione un proveedor'),
	name: NameSchema(),
	/** Lens type — strict enum, mapped to Postgres lens_type */
	type: z.nativeEnum(LensType, { message: 'Tipo de lente requerido' }),
	/**
	 * Foreign key to lens_technologies.
	 * Optional — finished lenses (FINISHED source) do not use a digital design.
	 */
	technologyId: z
		.union([z.literal(''), z.string().uuid()])
		.optional()
		.transform((val) => val || undefined),
	/**
	 * Free-form differentiator tags (e.g. ["UV400", "Hidrofóbico"]).
	 * Sent as a JSON string from forms; parsed to string[].
	 */
	differentiators: StringArraySchema,
	materialId: PendingEntitySchema('pending_material_', 'Seleccione un material'),
	pendingSupplierName: z.string().optional(),
	pendingMaterialName: z.string().optional(),
	pendingMaterialRefractiveIndex: RefractiveIndexSchema.optional(),
	pendingTechnologyName: z.string().optional(),
	ranges: RangesJsonSchema,

	// --- Inherent traits (booleans) ---
	hasAr: CoercedBoolean.default(false),
	/** Available AR coating color variants (e.g. ["Verde", "Azul"]). */
	arColors: StringArraySchema,
	hasBluecut: CoercedBoolean.default(false),
	isPhotochromic: CoercedBoolean.default(false),
	/** Available photochromic color variants (e.g. ["Gris", "Marrón"]). */
	photochromicColors: StringArraySchema,

	// --- Pricing ---
	priceType: z.enum(LensPriceType).default(LensPriceType.UNIT),
	basePrice: CoercedNumber.min(0, 'Precio de compra debe ser ≥ 0'),
	salePrice: CoercedNumber.min(0, 'Precio de venta debe ser ≥ 0').optional(),
	mountingPrice: CoercedNumber.min(0, 'Precio de montaje debe ser ≥ 0').default(0),
	shippingPrice: CoercedNumber.min(0, 'Precio de envío debe ser ≥ 0').default(0),

	// --- Tax ---
	isTaxable: CoercedBoolean.default(false),

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
	type: z.nativeEnum(LensType).optional(),
	/** Filter by technology FK — replaces old free-text `technology` filter */
	technologyId: z.uuid().optional()
});

// Schema for lens-specific supplier operations (different from SupplierIdSchema in suppliers.ts)
export const LensSupplierIdSchema = z.object({
	supplierId: z.uuid()
});
