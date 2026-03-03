import { describe, it, expect } from 'vitest';
import {
	ProductType,
	ALL_PRODUCT_TYPES,
	MATERIAL_CATEGORIES,
	toMaterialCategory,
	requiresStockTracking
} from './productTypes';

describe('ProductType enum', () => {
	it('has all expected product types', () => {
		expect(ALL_PRODUCT_TYPES).toContain(ProductType.FRAME);
		expect(ALL_PRODUCT_TYPES).toContain(ProductType.SUNGLASSES);
		expect(ALL_PRODUCT_TYPES).toContain(ProductType.CONTACT_LENS);
		expect(ALL_PRODUCT_TYPES).toContain(ProductType.ACCESSORY);
		expect(ALL_PRODUCT_TYPES).toHaveLength(4);
	});
});

describe('MATERIAL_CATEGORIES', () => {
	it('excludes SUNGLASSES (shares materials with FRAME) and LENS (separate table)', () => {
		expect(MATERIAL_CATEGORIES).toContain(ProductType.FRAME);
		expect(MATERIAL_CATEGORIES).toContain(ProductType.CONTACT_LENS);
		expect(MATERIAL_CATEGORIES).toContain(ProductType.ACCESSORY);
		expect(MATERIAL_CATEGORIES).not.toContain(ProductType.SUNGLASSES);
		expect(MATERIAL_CATEGORIES).not.toContain('LENS');
		expect(MATERIAL_CATEGORIES).not.toContain('ALL');
	});
});

describe('toMaterialCategory', () => {
	it('maps SUNGLASSES to FRAME', () => {
		expect(toMaterialCategory(ProductType.SUNGLASSES)).toBe(ProductType.FRAME);
	});

	it('maps FRAME, CONTACT_LENS, ACCESSORY to themselves', () => {
		expect(toMaterialCategory(ProductType.FRAME)).toBe(ProductType.FRAME);
		expect(toMaterialCategory(ProductType.CONTACT_LENS)).toBe(ProductType.CONTACT_LENS);
		expect(toMaterialCategory(ProductType.ACCESSORY)).toBe(ProductType.ACCESSORY);
	});
});

describe('requiresStockTracking', () => {
	it('returns true for all product types (they are all physical inventory)', () => {
		expect(requiresStockTracking(ProductType.FRAME)).toBe(true);
		expect(requiresStockTracking(ProductType.SUNGLASSES)).toBe(true);
		expect(requiresStockTracking(ProductType.CONTACT_LENS)).toBe(true);
		expect(requiresStockTracking(ProductType.ACCESSORY)).toBe(true);
	});
});
