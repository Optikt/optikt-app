/**
 * Lens related enums
 */

export enum LensType {
	MONOFOCAL = 'MONOFOCAL',
	BIFOCAL = 'BIFOCAL',
	PROGRESSIVE = 'PROGRESSIVE',
	OCCUPATIONAL = 'OCCUPATIONAL'
}

/** How the lens is produced */
export enum LensCatalogSource {
	/** Pre-fabricated with fixed prescription — may or may not be in stock */
	FINISHED = 'FINISHED',
	/** Custom-made by a laboratory for a specific Rx */
	LAB = 'LAB'
}

/** How the supplier prices this lens: per single unit or per pair */
export enum LensPriceType {
	UNIT = 'UNIT',
	PAIR = 'PAIR'
}

/** Treatment category — what kind of treatment a lab offers */
export enum TreatmentCategory {
	AR = 'AR',
	BLUECUT = 'BLUECUT'
}

/** Sale item type — what kind of line item this is in an order */
export enum SaleItemType {
	PRODUCT = 'PRODUCT',
	LENS_PAIR = 'LENS_PAIR',
	TREATMENT = 'TREATMENT'
}

// ── Labels ──────────────────────────────────────────────────────────────

export const LENS_TYPE_LABELS: Record<LensType, string> = {
	[LensType.MONOFOCAL]: 'Monofocal',
	[LensType.BIFOCAL]: 'Bifocal',
	[LensType.PROGRESSIVE]: 'Progresivo',
	[LensType.OCCUPATIONAL]: 'Ocupacional'
};

export const LENS_SOURCE_LABELS: Record<LensCatalogSource, string> = {
	[LensCatalogSource.FINISHED]: 'Terminado',
	[LensCatalogSource.LAB]: 'Laboratorio'
};

export const LENS_PRICE_TYPE_LABELS: Record<LensPriceType, string> = {
	[LensPriceType.UNIT]: 'Por Unidad',
	[LensPriceType.PAIR]: 'Por Par'
};

export const TREATMENT_CATEGORY_LABELS: Record<TreatmentCategory, string> = {
	[TreatmentCategory.AR]: 'Antirreflejo',
	[TreatmentCategory.BLUECUT]: 'Bluecut'
};

export const SALE_ITEM_TYPE_LABELS: Record<SaleItemType, string> = {
	[SaleItemType.PRODUCT]: 'Producto',
	[SaleItemType.LENS_PAIR]: 'Cristales',
	[SaleItemType.TREATMENT]: 'Tratamiento'
};

// ── Convenience arrays ──────────────────────────────────────────────────

export const ALL_LENS_TYPES = Object.values(LensType) as LensType[];
export const ALL_LENS_SOURCES = Object.values(LensCatalogSource) as LensCatalogSource[];
export const ALL_LENS_PRICE_TYPES = Object.values(LensPriceType) as LensPriceType[];
export const ALL_TREATMENT_CATEGORIES = Object.values(TreatmentCategory) as TreatmentCategory[];
export const ALL_SALE_ITEM_TYPES = Object.values(SaleItemType) as SaleItemType[];

// ── Label helpers ───────────────────────────────────────────────────────

export function getLensTypeLabel(type: string): string {
	return LENS_TYPE_LABELS[type as LensType] ?? type;
}

export function getLensSourceLabel(source: string): string {
	return LENS_SOURCE_LABELS[source as LensCatalogSource] ?? source;
}

export function getPriceTypeLabel(unit: string): string {
	return LENS_PRICE_TYPE_LABELS[unit as LensPriceType] ?? unit;
}

export function getTreatmentCategoryLabel(cat: string): string {
	return TREATMENT_CATEGORY_LABELS[cat as TreatmentCategory] ?? cat;
}

// ── Badge colors ────────────────────────────────────────────────────────

export const lensTypeBadgeColors: Record<LensType, 'blue' | 'green' | 'purple' | 'yellow'> = {
	[LensType.MONOFOCAL]: 'blue',
	[LensType.BIFOCAL]: 'green',
	[LensType.PROGRESSIVE]: 'purple',
	[LensType.OCCUPATIONAL]: 'yellow'
};

export type LensTypeColor = (typeof lensTypeBadgeColors)[LensType];

export function getLensTypeBadgeColor(type: string): LensTypeColor {
	return lensTypeBadgeColors[type as LensType] ?? 'blue';
}
