import { describe, it, expect } from 'vitest';
import {
	ProductType,
	ALL_PRODUCT_TYPES,
	MATERIAL_PRODUCT_TYPES,
	toMaterialProductType,
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

describe('MATERIAL_PRODUCT_TYPES', () => {
	it('excludes SUNGLASSES (shares materials with FRAME)', () => {
		expect(MATERIAL_PRODUCT_TYPES).toContain(ProductType.FRAME);
		expect(MATERIAL_PRODUCT_TYPES).toContain(ProductType.CONTACT_LENS);
		expect(MATERIAL_PRODUCT_TYPES).toContain(ProductType.ACCESSORY);
		expect(MATERIAL_PRODUCT_TYPES).toContain('ALL');
		expect(MATERIAL_PRODUCT_TYPES).not.toContain(ProductType.SUNGLASSES);
	});
});

describe('toMaterialProductType', () => {
	it('maps SUNGLASSES to FRAME', () => {
		expect(toMaterialProductType(ProductType.SUNGLASSES)).toBe(ProductType.FRAME);
	});

	it('maps FRAME, CONTACT_LENS, ACCESSORY to themselves', () => {
		expect(toMaterialProductType(ProductType.FRAME)).toBe(ProductType.FRAME);
		expect(toMaterialProductType(ProductType.CONTACT_LENS)).toBe(ProductType.CONTACT_LENS);
		expect(toMaterialProductType(ProductType.ACCESSORY)).toBe(ProductType.ACCESSORY);
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
