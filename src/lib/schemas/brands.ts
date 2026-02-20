/**
 * Brands validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';

export const ListBrandsSchema = z.object({
	page: z.int().min(1).default(1),
	perPage: z.int().min(1).max(100).default(10),
	search: z.string().optional(),
	includeDeleted: z.boolean().default(false)
});

export const CreateBrandSchema = z.object({
	name: z.string().min(1, 'Nombre requerido').max(255),
	description: z.string().optional(),
	country: z.string().optional(),
	website: z.string().optional()
});

export const UpdateBrandSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1, 'Nombre requerido').max(255).optional(),
	description: z.string().optional(),
	country: z.string().optional(),
	website: z.string().optional()
});

export const BrandIdSchema = z.object({
	id: z.uuid()
});

/**
 * Quick create schema - minimal fields for inline creation
 */
export const QuickCreateBrandSchema = z.object({
	name: z.string().min(1, 'Nombre requerido').max(255)
});
