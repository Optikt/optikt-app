/**
 * Product type enum
 * Defines the types of products in inventory
 */

export enum ProductType {
	/** Eyeglass frames */
	FRAME = 'FRAME',
	/** Sunglasses */
	SUNGLASSES = 'SUNGLASSES',
	/** Contact lenses */
	CONTACT_LENS = 'CONTACT_LENS',
	/** Accessories (cases, cloths, cleaning solutions) */
	ACCESSORY = 'ACCESSORY'
}

export const ALL_PRODUCT_TYPES = Object.values(ProductType) as ProductType[];

/** Labels for display in Spanish */
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
	[ProductType.FRAME]: 'Montura',
	[ProductType.SUNGLASSES]: 'Lentes de sol',
	[ProductType.CONTACT_LENS]: 'Lentes de contacto',
	[ProductType.ACCESSORY]: 'Accesorio'
};

/** Get the display label for a product type, with fallback to the raw value */
export function getProductTypeLabel(type: string): string {
	return PRODUCT_TYPE_LABELS[type as ProductType] ?? type;
}

/**
 * Product type badge colors
 */
export const typeColors: Record<ProductType, 'blue' | 'green' | 'purple' | 'yellow'> = {
	[ProductType.FRAME]: 'blue',
	[ProductType.SUNGLASSES]: 'green',
	[ProductType.CONTACT_LENS]: 'purple',
	[ProductType.ACCESSORY]: 'yellow'
};

export type ProductTypeColor = (typeof typeColors)[ProductType];

export function getProductTypeBadgeColor(type: string): ProductTypeColor | 'gray' {
	return typeColors[type as ProductType] ?? 'gray';
}

/** @deprecated Use getProductTypeBadgeColor instead */
export function getProductTypeColor(type: string): ProductTypeColor | 'gray' {
	return getProductTypeBadgeColor(type);
}

/** All product types require stock tracking */
export const STOCK_REQUIRED_TYPES: ProductType[] = [
	ProductType.FRAME,
	ProductType.SUNGLASSES,
	ProductType.CONTACT_LENS,
	ProductType.ACCESSORY
];

/**
 * Check if a product type requires stock tracking
 */
export function requiresStockTracking(type: ProductType): boolean {
	return STOCK_REQUIRED_TYPES.includes(type);
}

// ============================================================================
// MATERIAL CATEGORIES
// ============================================================================

/**
 * Valid categories for materials.
 * These categorize what type of product a material is used for:
 * - FRAME: frame materials (Titanium, Acetate, TR90, etc.)
 * - CONTACT_LENS: contact lens materials
 * - ACCESSORY: accessory materials (Leather, Microfiber, etc.)
 *
 * Note: SUNGLASSES is excluded because sunglasses and frames share materials.
 * Note: LENS is excluded because lens materials have a dedicated table (`lens_materials`)
 * managed separately from the `/lenses` page.
 * Use toMaterialCategory() to convert a ProductType to its material category.
 */
export const MATERIAL_CATEGORIES = [
	ProductType.FRAME,
	ProductType.CONTACT_LENS,
	ProductType.ACCESSORY
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/** Labels for display in Spanish */
export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
	[ProductType.FRAME]: 'Montura / Lentes de sol',
	[ProductType.CONTACT_LENS]: 'Lente de contacto',
	[ProductType.ACCESSORY]: 'Accesorio'
};

/**
 * Convert a ProductType to its MaterialCategory equivalent.
 * SUNGLASSES → FRAME (they share materials)
 * All others map 1:1
 */
export function toMaterialCategory(type: ProductType): MaterialCategory {
	return type === ProductType.SUNGLASSES ? ProductType.FRAME : type;
}
