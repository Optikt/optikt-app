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
 * Inline SVG icon strings for each product type (Lucide-style, 24x24 viewBox).
 * Used in custom HTML renderers where Svelte components aren't available.
 */
export const PRODUCT_TYPE_ICON_SVG: Record<ProductType, string> = {
	[ProductType.FRAME]: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-4 0"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.4-2-3-2"/></svg>`,
	[ProductType.SUNGLASSES]: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
	[ProductType.CONTACT_LENS]: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`,
	[ProductType.ACCESSORY]: `<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`
};

/** Get inline SVG icon HTML for a product type */
export function getProductTypeIconSvg(type: string, size = 14): string {
	const svg = PRODUCT_TYPE_ICON_SVG[type as ProductType];
	if (!svg) return '';
	return svg.replaceAll('SIZE', String(size));
}

/** Badge color hex values for inline HTML styles */
export const PRODUCT_TYPE_BADGE_COLORS: Record<ProductType, { bg: string; text: string }> = {
	[ProductType.FRAME]: { bg: '#eff6ff', text: '#1d4ed8' },
	[ProductType.SUNGLASSES]: { bg: '#f0fdf4', text: '#15803d' },
	[ProductType.CONTACT_LENS]: { bg: '#faf5ff', text: '#7e22ce' },
	[ProductType.ACCESSORY]: { bg: '#fefce8', text: '#a16207' }
};

/** Get badge color hex values for a product type (for inline HTML) */
export function getProductTypeBadgeHex(type: string): { bg: string; text: string } {
	return PRODUCT_TYPE_BADGE_COLORS[type as ProductType] ?? { bg: '#f1f5f9', text: '#475569' };
}

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
