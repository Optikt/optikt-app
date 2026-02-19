/**
 * Lens related enums
 */

export enum LensType {
	MONOFOCAL = 'MONOFOCAL',
	BIFOCAL = 'BIFOCAL',
	PROGRESSIVE = 'PROGRESSIVE',
	OCCUPATIONAL = 'OCCUPATIONAL'
}

export enum LensCatalogSource {
	FINISHED = 'FINISHED',
	LAB = 'LAB'
}

/** Whether the supplier prices per single lens or per pair */
export enum LensPricingUnit {
	UNIT = 'UNIT',
	PAIR = 'PAIR'
}

/** Labels for display in Spanish */
export const LENS_TYPE_LABELS: Record<LensType, string> = {
	[LensType.MONOFOCAL]: 'Monofocal',
	[LensType.BIFOCAL]: 'Bifocal',
	[LensType.PROGRESSIVE]: 'Progresivo',
	[LensType.OCCUPATIONAL]: 'Ocupacional'
};

/** Lens catalog source labels */
export const LENS_SOURCE_LABELS: Record<LensCatalogSource, string> = {
	[LensCatalogSource.FINISHED]: 'Terminado',
	[LensCatalogSource.LAB]: 'Laboratorio'
};

/** Pricing unit labels */
export const LENS_PRICING_UNIT_LABELS: Record<LensPricingUnit, string> = {
	[LensPricingUnit.UNIT]: 'Por Unidad',
	[LensPricingUnit.PAIR]: 'Por Par'
};

export const ALL_LENS_TYPES = Object.values(LensType) as LensType[];
export const ALL_LENS_SOURCES = Object.values(LensCatalogSource) as LensCatalogSource[];
export const ALL_LENS_PRICING_UNITS = Object.values(LensPricingUnit) as LensPricingUnit[];

/** Get the display label for a lens type, with fallback to the raw value */
export function getLensTypeLabel(type: string): string {
	return LENS_TYPE_LABELS[type as LensType] ?? type;
}

/** Get the display label for a lens source, with fallback to the raw value */
export function getLensSourceLabel(source: string): string {
	return LENS_SOURCE_LABELS[source as LensCatalogSource] ?? source;
}

/** Get the display label for a pricing unit, with fallback to the raw value */
export function getPricingUnitLabel(unit: string): string {
	return LENS_PRICING_UNIT_LABELS[unit as LensPricingUnit] ?? unit;
}

export function getLensTypeBadgeColor(type: string): 'blue' | 'green' | 'purple' | 'yellow' {
	switch (type) {
		case LensType.MONOFOCAL:
			return 'blue';
		case LensType.BIFOCAL:
			return 'green';
		case LensType.PROGRESSIVE:
			return 'purple';
		case LensType.OCCUPATIONAL:
			return 'yellow';
		default:
			return 'blue';
	}
}
