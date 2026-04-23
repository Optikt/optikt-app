import { describe, expect, it } from 'vitest';
import { ProductType } from '$lib/shared/enums/productTypes';
import {
	buildMaterialCode,
	getMaterialCodePrefix,
	normalizeMaterialCodeSegment
} from './materialCodes';

describe('materialCodes', () => {
	it('uses category-specific prefixes for shared names', () => {
		expect(buildMaterialCode('Metal', 'FRAME')).toBe('MO_METAL');
		expect(buildMaterialCode('Metal', 'SUNGLASSES')).toBe('MO_METAL');
		expect(buildMaterialCode('Metal', 'ACCESSORY')).toBe('AC_METAL');
		expect(buildMaterialCode('Metal', 'CONTACT_LENS')).toBe('LC_METAL');
	});

	it('normalizes names into stable code segments', () => {
		expect(normalizeMaterialCodeSegment('Metal Premium++')).toBe('METAL_PREM');
		expect(normalizeMaterialCodeSegment('   ???   ')).toBe('MATERIAL');
	});

	it('adds numeric suffixes for same-category collisions', () => {
		expect(buildMaterialCode('Metal', 'FRAME', 2)).toBe('MO_METAL_2');
		expect(buildMaterialCode('Metal', 'FRAME', 3)).toBe('MO_METAL_3');
	});

	it('truncates long codes before appending suffixes', () => {
		expect(buildMaterialCode('Super Extra Long Material Name', 'ACCESSORY')).toBe('AC_SUPER_EXTR');
		expect(buildMaterialCode('Super Extra Long Material Name', 'ACCESSORY', 12)).toBe(
			'AC_SUPER_EXTR_12'
		);
	});

	it('falls back to the product type initials for unknown categories', () => {
		expect(getMaterialCodePrefix('CUSTOM_TYPE')).toBe('CU');
	});

	it('maps sunglasses to the same prefix as frame materials', () => {
		expect(getMaterialCodePrefix(ProductType.SUNGLASSES)).toBe('MO');
		expect(getMaterialCodePrefix(ProductType.FRAME)).toBe('MO');
	});
});
