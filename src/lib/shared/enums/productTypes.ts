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
