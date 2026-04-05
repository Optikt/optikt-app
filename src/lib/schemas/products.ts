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
	OptionalPendingEntitySchema,
	PendingEntitySchema,
	ListPaginationSchema
} from './common';

// Single source of truth for SKU validation
// SKU format: only uppercase letters, numbers, hyphens (no spaces, no special chars)
const SkuSchema = z
	.string()
	.min(1, 'SKU requerido')
	.max(50, 'SKU muy largo (máximo 50 caracteres)')
	.regex(/^[A-Z0-9-]+$/, 'SKU inválido: solo mayúsculas, números y guiones');

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
	color: z.string().optional(),
	size: z.string().optional(),
	description: z.string().optional(),
	isTaxable: CoercedBoolean.default(true),
	taxRate: CoercedNumber.min(0, 'Tasa de impuesto debe ser mayor o igual a 0').default(16),
	stock: CoercedInteger.min(0).optional(),
	minStock: CoercedInteger.min(0).optional(),
	imageUrl: z.string().optional()
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

export const ReactivateProductSchema = z.object({
	deletedProductId: z.uuid()
});
