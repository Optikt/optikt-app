/**
 * Brands validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import {
	NameSchema,
	ListPaginationWithDeletedSchema,
	EntityIdSchema,
	OptionalUrlSchema
} from './common';

export const ListBrandsSchema = ListPaginationWithDeletedSchema;

export const CreateBrandSchema = z.object({
	name: NameSchema(),
	description: z.string().optional(),
	country: z.string().optional(),
	website: OptionalUrlSchema
});

export const UpdateBrandSchema = CreateBrandSchema.partial().extend({
	id: z.uuid()
});

export const BrandIdSchema = EntityIdSchema();

export const ReactivateBrandSchema = z.object({
	deletedBrandId: z.uuid()
});

/**
 * Quick create schema - We already have minimal fields for inline creation.
 * Rename it to QuickCreateBrandSchema for clarity
 */
export const QuickCreateBrandSchema = CreateBrandSchema;
