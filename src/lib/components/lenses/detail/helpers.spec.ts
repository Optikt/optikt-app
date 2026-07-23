import { describe, expect, it } from 'vitest';

import {
	getLensInventorySummary,
	getLensInventoryVariant,
	getLensMarginPercent,
	getLensSourceVariant,
	getLensTaxSummary,
	getLensTotalCost
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

	it('calculates total cost by summing pairPurchasePrice, mounting and shipping', () => {
		expect(getLensTotalCost(57, 3, 0)).toBe(60);
		expect(getLensTotalCost(3, 3, 4)).toBe(10);
		expect(getLensTotalCost(5, 0, 0)).toBe(5);
	});

	it('calculates gross margin from total cost and sale price', () => {
		expect(getLensMarginPercent(10, 25)).toBe(60);
		expect(getLensMarginPercent(60, 120)).toBe(50);
		expect(getLensMarginPercent(40, null)).toBeNull();
	});

	it('returns negative margin when selling below total cost', () => {
		expect(getLensMarginPercent(30, 20)).toBeCloseTo(-50);
	});

	it('returns null when total cost is zero or missing sale price', () => {
		expect(getLensMarginPercent(0, 50)).toBeNull();
		expect(getLensMarginPercent(10, undefined)).toBeNull();
	});

	it('formats tax summary labels', () => {
		expect(getLensTaxSummary(false)).toBe('Exento');
		expect(getLensTaxSummary(true)).toBe('IVA activo');
	});
});
