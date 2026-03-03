/**
 * Materials validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import {
	MATERIAL_CATEGORIES,
	ProductType,
	type MaterialCategory
} from '$lib/shared/enums/productTypes';
import { NameSchema, EntityIdSchema, ListPaginationWithDeletedSchema } from './common';

export const MaterialCategories = MATERIAL_CATEGORIES;
export type { MaterialCategory };

export const ListMaterialsSchema = ListPaginationWithDeletedSchema.extend({
	productType: z.enum(MATERIAL_CATEGORIES).optional()
});

export const MaterialIdSchema = EntityIdSchema();

export const CreateMaterialSchema = z.object({
	name: NameSchema(),
	code: NameSchema('Código requerido'),
	productType: z.enum(MATERIAL_CATEGORIES),
	description: z.string().optional()
});

export const UpdateMaterialSchema = CreateMaterialSchema.partial().extend({
	id: z.uuid()
});

export const ReactivateMaterialSchema = z.object({
	deletedMaterialId: z.uuid()
});

/**
 * Quick create schema - minimal fields for inline creation
 * Code is auto-generated from name
 */
export const QuickCreateMaterialSchema = z.object({
	name: NameSchema(),
	productType: z.enum(MATERIAL_CATEGORIES).default(ProductType.FRAME)
});
