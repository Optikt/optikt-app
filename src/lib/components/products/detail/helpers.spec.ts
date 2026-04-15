import { describe, expect, it } from 'vitest';

import { formatQuantityDelta, getInventoryValuation, getStockHealth } from './helpers';

describe('product detail helpers', () => {
	it('calculates inventory valuation from all active lots', () => {
		expect(
			getInventoryValuation([
				{ quantityAvailable: 12, unitPurchasePrice: 68.5 },
				{ quantityAvailable: 30, unitPurchasePrice: 74 }
			])
		).toBe(3042);
	});

	it('marks stock as sold out when quantity is zero', () => {
		expect(getStockHealth(0, 10)).toEqual({
			label: 'Agotado',
			variant: 'error'
		});
	});

	it('marks stock as low when quantity reaches the minimum', () => {
		expect(getStockHealth(5, 5)).toEqual({
			label: 'Stock bajo',
			variant: 'warning'
		});
	});

	it('marks stock as healthy when quantity is above minimum', () => {
		expect(getStockHealth(18, 5)).toEqual({
			label: 'Saludable',
			variant: 'success'
		});
	});

	it('uses a neutral label when no minimum stock exists', () => {
		expect(getStockHealth(8, null)).toEqual({
			label: 'Sin minimo',
			variant: 'neutral'
		});
	});

	it('formats positive and negative movement deltas', () => {
		expect(formatQuantityDelta(4)).toBe('+4');
		expect(formatQuantityDelta(-2)).toBe('-2');
	});
});
