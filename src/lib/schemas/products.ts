/**
 * Products validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { ProductType } from '$lib/shared/enums';
import { MaterialCategories } from './materials';
import {
	CoercedInteger,
	CoercedNumber,
	CoercedBoolean,
	NameSchema,
	EntityIdSchema,
	OptionalCoercedInteger,
	OptionalCoercedNumber,
	OptionalPendingEntitySchema,
	PendingEntitySchema,
	ListPaginationSchema,
	ReactivateEntitySchema
} from './common';

// Single source of truth for SKU validation
// SKU format: only uppercase letters, numbers, hyphens (no spaces, no special chars)
const SkuSchema = z
	.string()
	.trim()
	.toUpperCase()
	.min(1, 'SKU requerido')
	.max(50, 'SKU muy largo (máximo 50 caracteres)')
	.regex(/^[A-Z0-9-]+$/, 'SKU inválido: solo mayúsculas, números y guiones');

const OptionalUppercaseStringSchema = z.string().trim().toUpperCase().optional();

// export const ListProductsSchema = z.object({
export const ListProductsSchema = ListPaginationSchema.extend({
	type: z.enum(Object.values(ProductType) as [string, ...string[]]).optional(),
	brandId: z.uuid().optional(),
	supplierId: z.uuid().optional(),
	includeInactive: z.boolean().default(false),
	lowStockOnly: z.boolean().default(false),
	includeDeleted: z.boolean().default(false)
});

export const CreateProductSchema = z.object({
	sku: SkuSchema,
	name: NameSchema(),
	type: z.enum(ProductType, 'Tipo de producto requerido'),
	// brandId is optional and can be null
	brandId: OptionalPendingEntitySchema().optional(),
	// supplierId is REQUIRED - must be a valid UUID or pending ID
	supplierId: PendingEntitySchema('pending_', 'Seleccione un proveedor'),
	// materialId is REQUIRED - must be a valid UUID or pending material ID
	materialId: PendingEntitySchema('pending_material_', 'Seleccione un material'),
	// Pending entity names (sent when ID is pending_*)
	pendingBrandName: z.string().optional(),
	pendingSupplierName: z.string().optional(),
	pendingMaterialName: z.string().optional(),
	pendingMaterialCategory: z.enum(MaterialCategories).optional(),
	gender: z.string().optional(),
	personalCode: OptionalUppercaseStringSchema,
	isAutoSku: CoercedBoolean.default(false),
	color: z.string().optional(),
	size: z.string().optional(),
	description: z.string().optional(),
	isTaxable: CoercedBoolean.default(true),
	stock: CoercedInteger.min(0).optional(),
	minStock: CoercedInteger.min(0).optional(),
	imageUrl: z.string().optional(),
	// Physical attributes — Frames & Sunglasses
	lensWidth: OptionalCoercedInteger({
		min: 1,
		max: 99,
		integerMessage: 'Calibre debe ser un número entero válido',
		minMessage: 'Calibre debe ser mayor o igual a 1',
		maxMessage: 'Calibre debe ser menor o igual a 99'
	}),
	bridgeWidth: OptionalCoercedInteger({
		min: 1,
		max: 99,
		integerMessage: 'Puente debe ser un número entero válido',
		minMessage: 'Puente debe ser mayor o igual a 1',
		maxMessage: 'Puente debe ser menor o igual a 99'
	}),
	templeLength: OptionalCoercedInteger({
		min: 1,
		max: 999,
		integerMessage: 'Varilla debe ser un número entero válido',
		minMessage: 'Varilla debe ser mayor o igual a 1',
		maxMessage: 'Varilla debe ser menor o igual a 999'
	}),
	// Physical attributes — Contact Lenses
	baseCurve: OptionalCoercedNumber({
		min: 5,
		max: 10,
		invalidMessage: 'Curva base debe ser un número válido',
		minMessage: 'Curva base debe ser mayor o igual a 5',
		maxMessage: 'Curva base debe ser menor o igual a 10'
	}),
	diameter: OptionalCoercedNumber({
		min: 8,
		max: 20,
		invalidMessage: 'Diámetro debe ser un número válido',
		minMessage: 'Diámetro debe ser mayor o igual a 8',
		maxMessage: 'Diámetro debe ser menor o igual a 20'
	})
});

export const UpdateProductSchema = CreateProductSchema.partial().extend({
	id: z.uuid(),
	isActive: z.boolean().optional()
});

export const ProductIdSchema = EntityIdSchema();

export const UpdateSalePriceSchema = z.object({
	id: z.uuid(),
	currentSalePrice: CoercedNumber.min(0, 'Precio debe ser ≥ 0')
});

export const ReactivateProductSchema = ReactivateEntitySchema('deletedProductId');
