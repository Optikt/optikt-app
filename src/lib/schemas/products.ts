/**
 * Products validation schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';
import { ALL_PRODUCT_TYPES, ALL_CURRENCY_CODES } from '$lib/shared/enums';
import { MaterialProductTypes } from './materials';

// Single source of truth for SKU validation
// SKU format: only uppercase letters, numbers, hyphens (no spaces, no special chars)
const SkuSchema = v.pipe(
	v.string(),
	v.minLength(1, 'SKU requerido'),
	v.maxLength(50, 'SKU muy largo (máximo 50 caracteres)'),
	v.regex(/^[A-Z0-9-]+$/, 'SKU inválido: solo mayúsculas, números y guiones')
);

// Helper to coerce string to number for form inputs
const CoercedNumber = v.pipe(
	v.union([v.string(), v.number()]),
	v.transform((val) => (typeof val === 'string' ? parseFloat(val) : val)),
	v.number()
);

const CoercedInteger = v.pipe(
	v.union([v.string(), v.number()]),
	v.transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val)),
	v.number(),
	v.integer()
);

export const ListProductsSchema = v.object({
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	perPage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 10),
	search: v.optional(v.string()),
	type: v.optional(v.picklist(ALL_PRODUCT_TYPES)),
	brandId: v.optional(v.pipe(v.string(), v.uuid())),
	supplierId: v.optional(v.pipe(v.string(), v.uuid())),
	includeInactive: v.optional(v.boolean(), false),
	lowStockOnly: v.optional(v.boolean(), false)
});

export const CreateProductSchema = v.object({
	sku: SkuSchema,
	name: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255)),
	type: v.picklist(ALL_PRODUCT_TYPES, 'Tipo de producto requerido'),
	// brandId is optional and can be null
	brandId: v.optional(
		v.union([
			v.literal(''),
			v.pipe(v.string(), v.uuid()),
			v.pipe(v.string(), v.startsWith('pending_'))
		])
	),
	// supplierId is REQUIRED - must be a valid UUID or pending ID
	supplierId: v.union(
		[v.pipe(v.string(), v.uuid()), v.pipe(v.string(), v.startsWith('pending_'))],
		'Proveedor es requerido'
	),
	// materialId is REQUIRED - must be a valid UUID or pending material ID
	materialId: v.union(
		[v.pipe(v.string(), v.uuid()), v.pipe(v.string(), v.startsWith('pending_material_'))],
		'Material es requerido'
	),
	// Pending entity names (sent when ID is pending_*)
	pendingBrandName: v.optional(v.string()),
	pendingSupplierName: v.optional(v.string()),
	pendingMaterialName: v.optional(v.string()),
	pendingMaterialProductType: v.optional(v.picklist(MaterialProductTypes)),
	gender: v.optional(v.string()),
	color: v.optional(v.string()),
	size: v.optional(v.string()),
	description: v.optional(v.string()),
	purchasePrice: v.pipe(
		CoercedNumber,
		v.minValue(0, 'Precio de compra debe ser mayor o igual a 0')
	),
	salePrice: v.pipe(CoercedNumber, v.minValue(0, 'Precio de venta debe ser mayor o igual a 0')),
	// Currency purchase fields
	purchaseCurrency: v.picklist(ALL_CURRENCY_CODES, 'Moneda de compra requerida'),
	purchaseCurrencyRate: v.pipe(
		CoercedNumber,
		v.minValue(0.01, 'Tasa de moneda de compra requerida')
	),
	purchaseUsdBcvRate: v.pipe(CoercedNumber, v.minValue(0.01, 'Tasa USD BCV requerida')),
	purchaseDate: v.pipe(v.string(), v.minLength(1, 'Fecha de compra requerida')),
	normalizedCostUsd: v.pipe(CoercedNumber, v.minValue(0)),
	stock: v.optional(v.pipe(CoercedInteger, v.minValue(0))),
	minStock: v.optional(v.pipe(CoercedInteger, v.minValue(0))),
	imageUrl: v.optional(v.string())
});

export const UpdateProductSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	sku: v.optional(SkuSchema),
	name: v.optional(v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255))),
	type: v.optional(v.picklist(ALL_PRODUCT_TYPES)),
	// brandId is optional and can be set to null (empty string)
	brandId: v.optional(
		v.union([
			v.literal(''),
			v.pipe(v.string(), v.uuid()),
			v.pipe(v.string(), v.startsWith('pending_'))
		])
	),
	// supplierId is required (cannot be null), but optional to update - cannot be empty string
	supplierId: v.optional(
		v.union([v.pipe(v.string(), v.uuid()), v.pipe(v.string(), v.startsWith('pending_'))])
	),
	// materialId is required (cannot be null), but optional to update - cannot be empty string
	materialId: v.optional(
		v.union([v.pipe(v.string(), v.uuid()), v.pipe(v.string(), v.startsWith('pending_material_'))])
	),
	// Pending entity names (sent when ID is pending_*)
	pendingBrandName: v.optional(v.string()),
	pendingSupplierName: v.optional(v.string()),
	pendingMaterialName: v.optional(v.string()),
	pendingMaterialProductType: v.optional(v.picklist(MaterialProductTypes)),
	gender: v.optional(v.string()),
	color: v.optional(v.string()),
	size: v.optional(v.string()),
	description: v.optional(v.string()),
	purchasePrice: v.optional(v.pipe(CoercedNumber, v.minValue(0))),
	salePrice: v.optional(v.pipe(CoercedNumber, v.minValue(0))),
	// Currency purchase fields
	purchaseCurrency: v.optional(v.picklist(ALL_CURRENCY_CODES)),
	purchaseCurrencyRate: v.optional(v.pipe(CoercedNumber, v.minValue(0.01))),
	purchaseUsdBcvRate: v.optional(v.pipe(CoercedNumber, v.minValue(0.01))),
	purchaseDate: v.optional(v.pipe(v.string(), v.minLength(1))),
	normalizedCostUsd: v.optional(v.pipe(CoercedNumber, v.minValue(0))),
	stock: v.optional(v.pipe(CoercedInteger, v.minValue(0))),
	minStock: v.optional(v.pipe(CoercedInteger, v.minValue(0))),
	imageUrl: v.optional(v.string()),
	isActive: v.optional(v.boolean())
});

export const ProductIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid())
});
