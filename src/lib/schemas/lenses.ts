/**
 * Lens validation schemas
 * Valibot schemas for lens materials, treatments, and catalog items
 */
import * as v from 'valibot';

// Coerce string to number (for form inputs)
const CoercedNumber = v.pipe(
	v.union([v.string(), v.number()]),
	v.transform((val) => (typeof val === 'string' ? parseFloat(val) : val)),
	v.number('Debe ser un número válido')
);

const CoercedInteger = v.pipe(
	v.union([v.string(), v.number()]),
	v.transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val)),
	v.pipe(v.number(), v.integer())
);

// ============================================================================
// LENS MATERIALS
// ============================================================================

export const CreateLensMaterialSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255)),
	code: v.pipe(v.string(), v.minLength(1, 'Código requerido'), v.maxLength(50)),
	refractiveIndex: v.optional(v.pipe(CoercedNumber, v.minValue(1.0), v.maxValue(2.0))),
	description: v.optional(v.string())
});

export const UpdateLensMaterialSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	code: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(50))),
	refractiveIndex: v.optional(v.pipe(CoercedNumber, v.minValue(1.0), v.maxValue(2.0))),
	description: v.optional(v.string()),
	isActive: v.optional(v.boolean())
});

// ============================================================================
// LENS TREATMENTS
// ============================================================================

export const CreateLensTreatmentSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255)),
	code: v.pipe(v.string(), v.minLength(1, 'Código requerido'), v.maxLength(50)),
	description: v.optional(v.string())
});

export const UpdateLensTreatmentSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	code: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(50))),
	description: v.optional(v.string()),
	isActive: v.optional(v.boolean())
});

// ============================================================================
// LENS CATALOG ITEMS
// ============================================================================

/** Allowed lens types */
export const LENS_TYPES = ['MONOFOCAL', 'BIFOCAL', 'PROGRESSIVE', 'OCCUPATIONAL'] as const;
export const LENS_TYPE_LABELS: Record<(typeof LENS_TYPES)[number], string> = {
	MONOFOCAL: 'Monofocal',
	BIFOCAL: 'Bifocal',
	PROGRESSIVE: 'Progresivo',
	OCCUPATIONAL: 'Ocupacional'
};

/** Lens catalog source — type is inferred from pgEnum, labels are for display */
export const LENS_SOURCE_LABELS: Record<'FINISHED' | 'LAB', string> = {
	FINISHED: 'Terminado',
	LAB: 'Laboratorio'
};

export const CreateLensCatalogItemSchema = v.object({
	source: v.optional(v.picklist(['FINISHED', 'LAB'] as const), 'LAB'),
	// supplierId accepts UUID or pending_* ID
	supplierId: v.union(
		[v.pipe(v.string(), v.uuid()), v.pipe(v.string(), v.startsWith('pending_'))],
		'Proveedor requerido'
	),
	name: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255)),
	brand: v.optional(v.string()),
	technology: v.optional(v.string()),
	type: v.picklist([...LENS_TYPES], 'Tipo de lente requerido'),
	// materialId accepts UUID or pending_material_* ID
	materialId: v.union(
		[v.pipe(v.string(), v.uuid()), v.pipe(v.string(), v.startsWith('pending_material_'))],
		'Material requerido'
	),
	// Pending entity names (sent when ID starts with pending_*)
	pendingSupplierName: v.optional(v.string()),
	pendingMaterialName: v.optional(v.string()),
	pendingMaterialRefractiveIndex: v.optional(
		v.pipe(CoercedNumber, v.minValue(1.0), v.maxValue(2.0))
	),
	sphereMin: v.pipe(CoercedNumber, v.minValue(-30), v.maxValue(30)),
	sphereMax: v.pipe(CoercedNumber, v.minValue(-30), v.maxValue(30)),
	cylinderMin: v.optional(v.pipe(CoercedNumber, v.minValue(-10), v.maxValue(0))),
	cylinderMax: v.optional(v.pipe(CoercedNumber, v.minValue(-10), v.maxValue(0))),
	additionMin: v.optional(v.pipe(CoercedNumber, v.minValue(0), v.maxValue(4.0))),
	additionMax: v.optional(v.pipe(CoercedNumber, v.minValue(0), v.maxValue(4.0))),
	baseFeatures: v.optional(v.array(v.string())),
	isPhotochromic: v.optional(v.boolean(), false),
	isBlueCut: v.optional(v.boolean(), false),
	isAR: v.optional(v.boolean(), false),
	basePrice: v.pipe(CoercedNumber, v.minValue(0, 'Precio de compra debe ser ≥ 0')),
	salePrice: v.optional(v.pipe(CoercedNumber, v.minValue(0, 'Precio de venta debe ser ≥ 0'))),
	deliveryDays: v.optional(v.pipe(CoercedInteger, v.minValue(0))),
	stock: v.optional(v.pipe(CoercedInteger, v.minValue(0))),
	refractiveIndex: v.optional(v.pipe(CoercedNumber, v.minValue(1.0), v.maxValue(2.0))),
	notes: v.optional(v.string())
});

export const UpdateLensCatalogItemSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	source: v.optional(v.picklist(['FINISHED', 'LAB'] as const)),
	supplierId: v.optional(
		v.union([v.pipe(v.string(), v.uuid()), v.pipe(v.string(), v.startsWith('pending_'))])
	),
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
	brand: v.optional(v.string()),
	technology: v.optional(v.string()),
	type: v.optional(v.picklist([...LENS_TYPES])),
	materialId: v.optional(
		v.union([v.pipe(v.string(), v.uuid()), v.pipe(v.string(), v.startsWith('pending_material_'))])
	),
	// Pending entity names
	pendingSupplierName: v.optional(v.string()),
	pendingMaterialName: v.optional(v.string()),
	pendingMaterialRefractiveIndex: v.optional(
		v.pipe(CoercedNumber, v.minValue(1.0), v.maxValue(2.0))
	),
	sphereMin: v.optional(v.pipe(CoercedNumber, v.minValue(-30), v.maxValue(30))),
	sphereMax: v.optional(v.pipe(CoercedNumber, v.minValue(-30), v.maxValue(30))),
	cylinderMin: v.optional(v.pipe(CoercedNumber, v.minValue(-10), v.maxValue(0))),
	cylinderMax: v.optional(v.pipe(CoercedNumber, v.minValue(-10), v.maxValue(0))),
	additionMin: v.optional(v.pipe(CoercedNumber, v.minValue(0), v.maxValue(4.0))),
	additionMax: v.optional(v.pipe(CoercedNumber, v.minValue(0), v.maxValue(4.0))),
	baseFeatures: v.optional(v.array(v.string())),
	isPhotochromic: v.optional(v.boolean()),
	isBlueCut: v.optional(v.boolean()),
	isAR: v.optional(v.boolean()),
	basePrice: v.optional(v.pipe(CoercedNumber, v.minValue(0))),
	salePrice: v.optional(v.pipe(CoercedNumber, v.minValue(0))),
	deliveryDays: v.optional(v.pipe(CoercedInteger, v.minValue(0))),
	stock: v.optional(v.pipe(CoercedInteger, v.minValue(0))),
	refractiveIndex: v.optional(v.pipe(CoercedNumber, v.minValue(1.0), v.maxValue(2.0))),
	notes: v.optional(v.string()),
	isActive: v.optional(v.boolean())
});

// ============================================================================
// COMMON
// ============================================================================

export const LensIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid())
});

export const ListLensCatalogSchema = v.object({
	search: v.optional(v.string()),
	source: v.optional(v.picklist(['FINISHED', 'LAB'] as const)),
	supplierId: v.optional(v.pipe(v.string(), v.uuid())),
	materialId: v.optional(v.pipe(v.string(), v.uuid())),
	type: v.optional(v.picklist([...LENS_TYPES])),
	technology: v.optional(v.string())
});

export const SupplierIdSchema = v.object({
	supplierId: v.pipe(v.string(), v.uuid())
});

export const UpsertSupplierTreatmentSchema = v.object({
	supplierId: v.pipe(v.string(), v.uuid()),
	treatmentId: v.pipe(v.string(), v.uuid()),
	price: v.pipe(CoercedNumber, v.minValue(0, 'Precio debe ser ≥ 0')),
	isAvailable: v.optional(v.boolean(), true)
});
