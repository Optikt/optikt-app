/**
 * Materials validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import {
	MATERIAL_PRODUCT_TYPES,
	ProductType,
	type MaterialProductType
} from '$lib/shared/enums/productTypes';

// Re-export for backward compatibility
export const MaterialProductTypes = MATERIAL_PRODUCT_TYPES;
export type { MaterialProductType };

export const ListMaterialsSchema = z.object({
	includeDeleted: z.boolean().default(false),
	productType: z.enum(MATERIAL_PRODUCT_TYPES).optional()
});

export const MaterialIdSchema = z.object({
	id: z.uuid()
});

/**
 * Quick create schema - minimal fields for inline creation
 * Code is auto-generated from name
 */
export const QuickCreateMaterialSchema = z.object({
	name: z.string().min(1, 'Nombre requerido').max(255),
	productType: z.enum(MATERIAL_PRODUCT_TYPES).default(ProductType.FRAME)
});
