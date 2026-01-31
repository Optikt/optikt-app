/**
 * Materials validation schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';

// Valid product types for materials
export const MaterialProductTypes = ['FRAME', 'LENS', 'CONTACT_LENS', 'ACCESSORY', 'ALL'] as const;
export type MaterialProductType = (typeof MaterialProductTypes)[number];

export const ListMaterialsSchema = v.object({
	includeDeleted: v.optional(v.boolean(), false),
	productType: v.optional(v.picklist(MaterialProductTypes))
});

export const MaterialIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid())
});

/**
 * Quick create schema - minimal fields for inline creation
 * Code is auto-generated from name
 */
export const QuickCreateMaterialSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nombre requerido'), v.maxLength(255)),
	productType: v.optional(v.picklist(MaterialProductTypes), 'FRAME')
});
