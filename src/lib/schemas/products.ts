/**
 * Products validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { ALL_PRODUCT_TYPES, ALL_CURRENCY_CODES } from '$lib/shared/enums';
import { MaterialProductTypes } from './materials';
import { CoercedInteger, CoercedNumber } from './common';

// Single source of truth for SKU validation
// SKU format: only uppercase letters, numbers, hyphens (no spaces, no special chars)
const SkuSchema = z
	.string()
	.min(1, 'SKU requerido')
	.max(50, 'SKU muy largo (máximo 50 caracteres)')
	.regex(/^[A-Z0-9-]+$/, 'SKU inválido: solo mayúsculas, números y guiones');

export const ListProductsSchema = z.object({
	page: z.int().min(1).default(1),
	perPage: z.int().min(1).max(100).default(10),
	search: z.string().optional(),
	type: z.enum(ALL_PRODUCT_TYPES).optional(),
	brandId: z.uuid().optional(),
	supplierId: z.uuid().optional(),
	includeInactive: z.boolean().default(false),
	lowStockOnly: z.boolean().default(false)
});

export const CreateProductSchema = z.object({
	sku: SkuSchema,
	name: z.string().min(1, 'Nombre requerido').max(255),
	type: z.enum(ALL_PRODUCT_TYPES, 'Tipo de producto requerido'),
	// brandId is optional and can be null
	brandId: z
		.union([z.literal(''), z.uuid(), z.string().startsWith('pending_')])
		.optional(),
	// supplierId is REQUIRED - must be a valid UUID or pending ID
	supplierId: z.union(
		[z.uuid(), z.string().startsWith('pending_')],
		'Proveedor es requerido'
	),
	// materialId is REQUIRED - must be a valid UUID or pending material ID
	materialId: z.union(
		[z.uuid(), z.string().startsWith('pending_material_')],
		'Material es requerido'
	),
	// Pending entity names (sent when ID is pending_*)
	pendingBrandName: z.string().optional(),
	pendingSupplierName: z.string().optional(),
	pendingMaterialName: z.string().optional(),
	pendingMaterialProductType: z.enum(MaterialProductTypes).optional(),
	gender: z.string().optional(),
	color: z.string().optional(),
	size: z.string().optional(),
	description: z.string().optional(),
	purchasePrice: CoercedNumber.min(0, 'Precio de compra debe ser mayor o igual a 0'),
	salePrice: CoercedNumber.min(0, 'Precio de venta debe ser mayor o igual a 0'),
	// Currency purchase fields
	purchaseCurrency: z.enum(ALL_CURRENCY_CODES, 'Moneda de compra requerida'),
	purchaseCurrencyRate: CoercedNumber.min(0.01, 'Tasa de moneda de compra requerida'),
	purchaseUsdBcvRate: CoercedNumber.min(0.01, 'Tasa USD BCV requerida'),
	purchaseDate: z.string().min(1, 'Fecha de compra requerida'),
	normalizedCostUsd: CoercedNumber.min(0),
	stock: CoercedInteger.min(0).optional(),
	minStock: CoercedInteger.min(0).optional(),
	imageUrl: z.string().optional()
});

export const UpdateProductSchema = z.object({
	id: z.uuid(),
	sku: SkuSchema.optional(),
	name: z.string().min(1, 'Nombre requerido').max(255).optional(),
	type: z.enum(ALL_PRODUCT_TYPES).optional(),
	// brandId is optional and can be set to null (empty string)
	brandId: z
		.union([z.literal(''), z.uuid(), z.string().startsWith('pending_')])
		.optional(),
	// supplierId is required (cannot be null), but optional to update - cannot be empty string
	supplierId: z.union([z.uuid(), z.string().startsWith('pending_')]).optional(),
	// materialId is required (cannot be null), but optional to update - cannot be empty string
	materialId: z.union([z.uuid(), z.string().startsWith('pending_material_')]).optional(),
	// Pending entity names (sent when ID is pending_*)
	pendingBrandName: z.string().optional(),
	pendingSupplierName: z.string().optional(),
	pendingMaterialName: z.string().optional(),
	pendingMaterialProductType: z.enum(MaterialProductTypes).optional(),
	gender: z.string().optional(),
	color: z.string().optional(),
	size: z.string().optional(),
	description: z.string().optional(),
	purchasePrice: CoercedNumber.min(0).optional(),
	salePrice: CoercedNumber.min(0).optional(),
	// Currency purchase fields
	purchaseCurrency: z.enum(ALL_CURRENCY_CODES).optional(),
	purchaseCurrencyRate: CoercedNumber.min(0.01).optional(),
	purchaseUsdBcvRate: CoercedNumber.min(0.01).optional(),
	purchaseDate: z.string().min(1).optional(),
	normalizedCostUsd: CoercedNumber.min(0).optional(),
	stock: CoercedInteger.min(0).optional(),
	minStock: CoercedInteger.min(0).optional(),
	imageUrl: z.string().optional(),
	isActive: z.boolean().optional()
});

export const ProductIdSchema = z.object({
	id: z.uuid()
});
