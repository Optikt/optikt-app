import { describe, expect, it } from 'vitest';

import {
	getLensInventorySummary,
	getLensInventoryVariant,
	getLensMarginPercent,
	getLensSourceVariant,
	getLensTaxSummary
} from './helpers';

describe('lens detail helpers', () => {
	it('returns the correct source badge variant', () => {
		expect(getLensSourceVariant('FINISHED')).toBe('info');
		expect(getLensSourceVariant('LAB')).toBe('warning');
	});

	it('summarizes on-demand and stock inventory states', () => {
		expect(getLensInventorySummary('ON_DEMAND', null)).toBe('Por demanda');
		expect(getLensInventorySummary('STOCK', 0)).toBe('Agotado');
		expect(getLensInventorySummary('STOCK', 8)).toBe('8 en stock');
	});

	it('returns the matching inventory badge variant', () => {
		expect(getLensInventoryVariant('ON_DEMAND', null)).toBe('warning');
		expect(getLensInventoryVariant('STOCK', 0)).toBe('error');
		expect(getLensInventoryVariant('STOCK', 4)).toBe('success');
	});

	it('calculates commercial margin from sale and purchase prices', () => {
		expect(getLensMarginPercent(40, 70)).toBe(75);
		expect(getLensMarginPercent(40, null)).toBeNull();
	});

	it('formats tax summary labels', () => {
		expect(getLensTaxSummary(false)).toBe('Exento');
		expect(getLensTaxSummary(true)).toBe('IVA activo');
	});
});
