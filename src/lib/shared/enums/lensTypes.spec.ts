import { describe, it, expect } from 'vitest';
import {
	LensType,
	LensCatalogSource,
	LensPriceType,
	LensInventoryMode,
	TreatmentCategory,
	SaleItemType,
	ALL_LENS_TYPES,
	ALL_LENS_SOURCES,
	ALL_LENS_PRICE_TYPES,
	ALL_LENS_INVENTORY_MODES,
	ALL_TREATMENT_CATEGORIES,
	ALL_SALE_ITEM_TYPES,
	LENS_TYPE_LABELS,
	LENS_SOURCE_LABELS,
	LENS_PRICE_TYPE_LABELS,
	LENS_INVENTORY_MODE_LABELS,
	TREATMENT_CATEGORY_LABELS,
	SALE_ITEM_TYPE_LABELS,
	getLensTypeLabel,
	getLensSourceLabel,
	getPriceTypeLabel,
	getInventoryModeLabel,
	getTreatmentCategoryLabel,
	lensTypeBadgeColors,
	getLensTypeBadgeColor
} from './lensTypes';

// ── LensType ────────────────────────────────────────────────────────────

describe('LensType enum', () => {
	it('has all expected values', () => {
		expect(LensType.MONOFOCAL).toBe('MONOFOCAL');
		expect(LensType.BIFOCAL).toBe('BIFOCAL');
		expect(LensType.PROGRESSIVE).toBe('PROGRESSIVE');
		expect(LensType.OCCUPATIONAL).toBe('OCCUPATIONAL');
	});

	it('ALL_LENS_TYPES contains all values', () => {
		expect(ALL_LENS_TYPES).toHaveLength(4);
		expect(ALL_LENS_TYPES).toContain(LensType.MONOFOCAL);
		expect(ALL_LENS_TYPES).toContain(LensType.BIFOCAL);
		expect(ALL_LENS_TYPES).toContain(LensType.PROGRESSIVE);
		expect(ALL_LENS_TYPES).toContain(LensType.OCCUPATIONAL);
	});
});

describe('getLensTypeLabel', () => {
	it('returns Spanish labels for known types', () => {
		expect(getLensTypeLabel('MONOFOCAL')).toBe('Monofocal');
		expect(getLensTypeLabel('BIFOCAL')).toBe('Bifocal');
		expect(getLensTypeLabel('PROGRESSIVE')).toBe('Progresivo');
		expect(getLensTypeLabel('OCCUPATIONAL')).toBe('Ocupacional');
	});

	it('has a label for every lens type', () => {
		for (const type of ALL_LENS_TYPES) {
			expect(LENS_TYPE_LABELS[type]).toBeDefined();
		}
	});

	it('returns raw value for unknown type', () => {
		expect(getLensTypeLabel('UNKNOWN')).toBe('UNKNOWN');
	});

	it('returns raw value for empty string', () => {
		expect(getLensTypeLabel('')).toBe('');
	});
});

describe('getLensTypeBadgeColor', () => {
	it('returns correct badge colors', () => {
		expect(getLensTypeBadgeColor('MONOFOCAL')).toBe('info');
		expect(getLensTypeBadgeColor('BIFOCAL')).toBe('success');
		expect(getLensTypeBadgeColor('PROGRESSIVE')).toBe('purple');
		expect(getLensTypeBadgeColor('OCCUPATIONAL')).toBe('warning');
	});

	it('has a color for every lens type', () => {
		for (const type of ALL_LENS_TYPES) {
			expect(lensTypeBadgeColors[type]).toBeDefined();
		}
	});

	it('returns info (default) for unknown type', () => {
		expect(getLensTypeBadgeColor('INVALID')).toBe('info');
	});
});

// ── LensCatalogSource ───────────────────────────────────────────────────

describe('LensCatalogSource enum', () => {
	it('has all expected values', () => {
		expect(LensCatalogSource.FINISHED).toBe('FINISHED');
		expect(LensCatalogSource.LAB).toBe('LAB');
	});

	it('ALL_LENS_SOURCES contains all values', () => {
		expect(ALL_LENS_SOURCES).toHaveLength(2);
		expect(ALL_LENS_SOURCES).toContain(LensCatalogSource.FINISHED);
		expect(ALL_LENS_SOURCES).toContain(LensCatalogSource.LAB);
	});
});

describe('getLensSourceLabel', () => {
	it('returns Spanish labels for known sources', () => {
		expect(getLensSourceLabel('FINISHED')).toBe('Terminado');
		expect(getLensSourceLabel('LAB')).toBe('Laboratorio');
	});

	it('has a label for every source', () => {
		for (const source of ALL_LENS_SOURCES) {
			expect(LENS_SOURCE_LABELS[source]).toBeDefined();
		}
	});

	it('returns raw value for unknown source', () => {
		expect(getLensSourceLabel('UNKNOWN')).toBe('UNKNOWN');
	});
});

// ── LensPriceType ───────────────────────────────────────────────────────

describe('LensPriceType enum', () => {
	it('has all expected values', () => {
		expect(LensPriceType.UNIT).toBe('UNIT');
		expect(LensPriceType.PAIR).toBe('PAIR');
	});

	it('ALL_LENS_PRICE_TYPES contains all values', () => {
		expect(ALL_LENS_PRICE_TYPES).toHaveLength(2);
		expect(ALL_LENS_PRICE_TYPES).toContain(LensPriceType.UNIT);
		expect(ALL_LENS_PRICE_TYPES).toContain(LensPriceType.PAIR);
	});
});

describe('getPriceTypeLabel', () => {
	it('returns Spanish labels for known price types', () => {
		expect(getPriceTypeLabel('UNIT')).toBe('Por Unidad');
		expect(getPriceTypeLabel('PAIR')).toBe('Por Par');
	});

	it('has a label for every price type', () => {
		for (const pt of ALL_LENS_PRICE_TYPES) {
			expect(LENS_PRICE_TYPE_LABELS[pt]).toBeDefined();
		}
	});

	it('returns raw value for unknown price type', () => {
		expect(getPriceTypeLabel('BULK')).toBe('BULK');
	});
});

// ── LensInventoryMode ───────────────────────────────────────────────────

describe('LensInventoryMode enum', () => {
	it('has all expected values', () => {
		expect(LensInventoryMode.ON_DEMAND).toBe('ON_DEMAND');
		expect(LensInventoryMode.STOCK).toBe('STOCK');
	});

	it('ALL_LENS_INVENTORY_MODES contains all values', () => {
		expect(ALL_LENS_INVENTORY_MODES).toHaveLength(2);
		expect(ALL_LENS_INVENTORY_MODES).toContain(LensInventoryMode.ON_DEMAND);
		expect(ALL_LENS_INVENTORY_MODES).toContain(LensInventoryMode.STOCK);
	});
});

describe('getInventoryModeLabel', () => {
	it('returns Spanish labels for known modes', () => {
		expect(getInventoryModeLabel('ON_DEMAND')).toBe('Por demanda');
		expect(getInventoryModeLabel('STOCK')).toBe('En inventario');
	});

	it('has a label for every inventory mode', () => {
		for (const mode of ALL_LENS_INVENTORY_MODES) {
			expect(LENS_INVENTORY_MODE_LABELS[mode]).toBeDefined();
		}
	});

	it('returns raw value for unknown mode', () => {
		expect(getInventoryModeLabel('CONSIGNMENT')).toBe('CONSIGNMENT');
	});
});

// ── TreatmentCategory ───────────────────────────────────────────────────

describe('TreatmentCategory enum', () => {
	it('has all expected values', () => {
		expect(TreatmentCategory.AR).toBe('AR');
		expect(TreatmentCategory.BLUECUT).toBe('BLUECUT');
	});

	it('ALL_TREATMENT_CATEGORIES contains all values', () => {
		expect(ALL_TREATMENT_CATEGORIES).toHaveLength(2);
		expect(ALL_TREATMENT_CATEGORIES).toContain(TreatmentCategory.AR);
		expect(ALL_TREATMENT_CATEGORIES).toContain(TreatmentCategory.BLUECUT);
	});
});

describe('getTreatmentCategoryLabel', () => {
	it('returns Spanish labels for known categories', () => {
		expect(getTreatmentCategoryLabel('AR')).toBe('Antirreflejo');
		expect(getTreatmentCategoryLabel('BLUECUT')).toBe('Bluecut');
	});

	it('has a label for every category', () => {
		for (const cat of ALL_TREATMENT_CATEGORIES) {
			expect(TREATMENT_CATEGORY_LABELS[cat]).toBeDefined();
		}
	});

	it('returns raw value for unknown category', () => {
		expect(getTreatmentCategoryLabel('PHOTOCHROMIC')).toBe('PHOTOCHROMIC');
	});
});

// ── SaleItemType ────────────────────────────────────────────────────────

describe('SaleItemType enum', () => {
	it('has all expected values', () => {
		expect(SaleItemType.PRODUCT).toBe('PRODUCT');
		expect(SaleItemType.LENS_PAIR).toBe('LENS_PAIR');
		expect(SaleItemType.TREATMENT).toBe('TREATMENT');
	});

	it('ALL_SALE_ITEM_TYPES contains all values', () => {
		expect(ALL_SALE_ITEM_TYPES).toHaveLength(3);
		expect(ALL_SALE_ITEM_TYPES).toContain(SaleItemType.PRODUCT);
		expect(ALL_SALE_ITEM_TYPES).toContain(SaleItemType.LENS_PAIR);
		expect(ALL_SALE_ITEM_TYPES).toContain(SaleItemType.TREATMENT);
	});

	it('has a label for every sale item type', () => {
		for (const type of ALL_SALE_ITEM_TYPES) {
			expect(SALE_ITEM_TYPE_LABELS[type]).toBeDefined();
		}
	});

	it('returns correct labels', () => {
		expect(SALE_ITEM_TYPE_LABELS[SaleItemType.PRODUCT]).toBe('Producto');
		expect(SALE_ITEM_TYPE_LABELS[SaleItemType.LENS_PAIR]).toBe('Cristales');
		expect(SALE_ITEM_TYPE_LABELS[SaleItemType.TREATMENT]).toBe('Tratamiento');
	});
});
