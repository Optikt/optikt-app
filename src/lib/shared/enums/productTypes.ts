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
	ACCESSORY = 'ACCESSORY',
	/** Pre-made/finished lenses in stock */
	LENS = 'LENS'
}

export const ALL_PRODUCT_TYPES = Object.values(ProductType) as ProductType[];

/** Labels for display in Spanish */
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
	[ProductType.FRAME]: 'Montura',
	[ProductType.SUNGLASSES]: 'Lentes de sol',
	[ProductType.CONTACT_LENS]: 'Lentes de contacto',
	[ProductType.ACCESSORY]: 'Accesorio',
	[ProductType.LENS]: 'Cristal terminado'
};

/** Types that require stock tracking */
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
// MATERIAL PRODUCT TYPES
// ============================================================================

/**
 * Valid product types for materials.
 * Note: SUNGLASSES is excluded because sunglasses and frames share materials.
 * Use toMaterialProductType() to convert a ProductType to its material equivalent.
 */
export const MATERIAL_PRODUCT_TYPES = [
	ProductType.FRAME,
	ProductType.LENS,
	ProductType.CONTACT_LENS,
	ProductType.ACCESSORY,
	'ALL'
] as const;
export type MaterialProductType = (typeof MATERIAL_PRODUCT_TYPES)[number];

/**
 * Convert a ProductType to its MaterialProductType equivalent.
 * SUNGLASSES → FRAME (they share materials)
 * All others map 1:1
 */
export function toMaterialProductType(type: ProductType): MaterialProductType {
	return type === ProductType.SUNGLASSES ? ProductType.FRAME : type;
}
