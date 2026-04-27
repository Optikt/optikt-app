/**
 * Lens related enums
 */

import type { BadgeVariant } from '$lib/shared/badge-variants';

export enum LensType {
	MONOFOCAL = 'MONOFOCAL',
	BIFOCAL = 'BIFOCAL',
	PROGRESSIVE = 'PROGRESSIVE',
	OCCUPATIONAL = 'OCCUPATIONAL'
}

/** How the lens is produced */
export enum LensCatalogSource {
	/** Pre-fabricated with fixed prescription - may or may not be in stock */
	FINISHED = 'FINISHED',
	/** Custom-made by a laboratory for a specific Rx */
	LAB = 'LAB'
}

/** How the supplier prices this lens: per single unit or per pair */
export enum LensPriceType {
	UNIT = 'UNIT',
	PAIR = 'PAIR'
}

/** How the lens inventory is managed */
export enum LensInventoryMode {
	/** Ordered on demand from supplier/lab - no stock tracking */
	ON_DEMAND = 'ON_DEMAND',
	/** Tracked inventory - stock count is maintained */
	STOCK = 'STOCK'
}

/** Treatment category - what kind of treatment a lab offers */
export enum TreatmentCategory {
	AR = 'AR',
	BLUECUT = 'BLUECUT'
}

/** Sale item type - what kind of line item this is in an order */
export enum SaleItemType {
	PRODUCT = 'PRODUCT',
	LENS_PAIR = 'LENS_PAIR',
	TREATMENT = 'TREATMENT',
	/** Ad-hoc free-form item ordered on demand (no catalog entry required) */
	FREE_ITEM = 'FREE_ITEM'
}

/** Category for FREE_ITEM sale items */
export enum FreeItemCategory {
	CONTACT_LENS_FORMULA = 'CONTACT_LENS_FORMULA',
	CONTACT_LENS_COSMETIC = 'CONTACT_LENS_COSMETIC',
	INTRAOCULAR_LENS = 'INTRAOCULAR_LENS',
	SERVICE = 'SERVICE',
	OTHER = 'OTHER'
}

/** Enrichment status for FREE_ITEM sale items */
export enum FreeItemEnrichmentStatus {
	PENDING = 'PENDING',
	ENRICHED = 'ENRICHED'
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

export const LENS_INVENTORY_MODE_LABELS: Record<LensInventoryMode, string> = {
	[LensInventoryMode.ON_DEMAND]: 'Por demanda',
	[LensInventoryMode.STOCK]: 'En inventario'
};

export const TREATMENT_CATEGORY_LABELS: Record<TreatmentCategory, string> = {
	[TreatmentCategory.AR]: 'Antirreflejo',
	[TreatmentCategory.BLUECUT]: 'Bluecut'
};

export const SALE_ITEM_TYPE_LABELS: Record<SaleItemType, string> = {
	[SaleItemType.PRODUCT]: 'Producto',
	[SaleItemType.LENS_PAIR]: 'Cristales',
	[SaleItemType.TREATMENT]: 'Tratamiento',
	[SaleItemType.FREE_ITEM]: 'Ítem Libre'
};

export const FREE_ITEM_CATEGORY_LABELS: Record<FreeItemCategory, string> = {
	[FreeItemCategory.CONTACT_LENS_FORMULA]: 'LC con fórmula',
	[FreeItemCategory.CONTACT_LENS_COSMETIC]: 'LC cosmético',
	[FreeItemCategory.INTRAOCULAR_LENS]: 'Lente intraocular (LIO)',
	[FreeItemCategory.SERVICE]: 'Servicio',
	[FreeItemCategory.OTHER]: 'Otro'
};

// ── Convenience arrays ──────────────────────────────────────────────────

export const ALL_LENS_TYPES = Object.values(LensType) as LensType[];
export const ALL_LENS_SOURCES = Object.values(LensCatalogSource) as LensCatalogSource[];
export const ALL_LENS_PRICE_TYPES = Object.values(LensPriceType) as LensPriceType[];
export const ALL_LENS_INVENTORY_MODES = Object.values(LensInventoryMode) as LensInventoryMode[];
export const ALL_TREATMENT_CATEGORIES = Object.values(TreatmentCategory) as TreatmentCategory[];
export const ALL_SALE_ITEM_TYPES = Object.values(SaleItemType) as SaleItemType[];
export const ALL_FREE_ITEM_CATEGORIES = Object.values(FreeItemCategory) as FreeItemCategory[];
export const ALL_FREE_ITEM_ENRICHMENT_STATUSES = Object.values(
	FreeItemEnrichmentStatus
) as FreeItemEnrichmentStatus[];

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

export function getInventoryModeLabel(mode: string): string {
	return LENS_INVENTORY_MODE_LABELS[mode as LensInventoryMode] ?? mode;
}

export function getTreatmentCategoryLabel(cat: string): string {
	return TREATMENT_CATEGORY_LABELS[cat as TreatmentCategory] ?? cat;
}

export function getFreeItemCategoryLabel(cat: string): string {
	return FREE_ITEM_CATEGORY_LABELS[cat as FreeItemCategory] ?? cat;
}

// ── Badge colors ────────────────────────────────────────────────────────

export const lensTypeBadgeColors: Record<LensType, BadgeVariant> = {
	[LensType.MONOFOCAL]: 'info',
	[LensType.BIFOCAL]: 'success',
	[LensType.PROGRESSIVE]: 'purple',
	[LensType.OCCUPATIONAL]: 'warning'
};

export function getLensTypeBadgeColor(type: string): BadgeVariant {
	return lensTypeBadgeColors[type as LensType] ?? 'info';
}
