import { describe, it, expect } from 'vitest';
import { isLowStock } from './products';

function makeProduct(overrides: { stock?: number | null; minStock?: number | null }) {
	return {
		id: 'prod-1',
		name: 'Test Product',
		sku: 'SKU-001',
		stock: overrides.stock ?? null,
		minStock: overrides.minStock ?? null,
		// Satisfy ProductWithRelations shape minimally
		brand: null,
		supplier: null,
		material: null
	} as Parameters<typeof isLowStock>[0];
}

describe('isLowStock', () => {
	it('returns false when stock is null', () => {
		expect(isLowStock(makeProduct({ stock: null, minStock: 5 }))).toBe(false);
	});

	it('returns false when minStock is null', () => {
		expect(isLowStock(makeProduct({ stock: 10, minStock: null }))).toBe(false);
	});

	it('returns false when both stock and minStock are null', () => {
		expect(isLowStock(makeProduct({ stock: null, minStock: null }))).toBe(false);
	});

	it('returns true when stock equals minStock', () => {
		expect(isLowStock(makeProduct({ stock: 5, minStock: 5 }))).toBe(true);
	});

	it('returns true when stock is below minStock', () => {
		expect(isLowStock(makeProduct({ stock: 2, minStock: 5 }))).toBe(true);
	});

	it('returns false when stock is above minStock', () => {
		expect(isLowStock(makeProduct({ stock: 10, minStock: 5 }))).toBe(false);
	});

	it('returns true when stock is zero and minStock is zero', () => {
		expect(isLowStock(makeProduct({ stock: 0, minStock: 0 }))).toBe(true);
	});

	it('returns true when stock is zero and minStock is positive', () => {
		expect(isLowStock(makeProduct({ stock: 0, minStock: 3 }))).toBe(true);
	});
});
