/**
 * Brands validation schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';

export const ListBrandsSchema = v.object({
	page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
	perPage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 10),
	search: v.optional(v.string()),
	includeDeleted: v.optional(v.boolean(), false)
});

export const CreateBrandSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255)),
	description: v.optional(v.string()),
	country: v.optional(v.string()),
	website: v.optional(v.string())
});

export const UpdateBrandSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.optional(v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255))),
	description: v.optional(v.string()),
	country: v.optional(v.string()),
	website: v.optional(v.string())
});

export const BrandIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid())
});
