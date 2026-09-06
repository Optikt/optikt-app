import { describe, expect, it } from 'vitest';

import { getAvailableProductStock, getRequestedProductQuantity } from './items';
import { makeProductRow, makeStockProduct } from './testFixtures';

describe('aggregate product stock helpers', () => {
	it('sums requested quantity for the same product across rows', () => {
		const items = [
			makeProductRow({ id: 'item-a', productId: 'prod-1', quantity: 2 }),
			makeProductRow({ id: 'item-b', productId: 'prod-1', quantity: 1 }),
			makeProductRow({ id: 'item-c', productId: 'prod-2', quantity: 3 })
		];

		expect(getRequestedProductQuantity(items, 'prod-1')).toBe(3);
		expect(getRequestedProductQuantity(items, 'prod-1', 'item-a')).toBe(1);
	});

	it('returns remaining stock excluding the current row quantity', () => {
		const items = [
			makeProductRow({ id: 'item-a', productId: 'prod-1', quantity: 1 }),
			makeProductRow({ id: 'item-b', productId: 'prod-1', quantity: 2 })
		];
		const products = [makeStockProduct('prod-1', 4)];

		expect(getAvailableProductStock(items, products, 'prod-1', 'item-a')).toBe(2);
		expect(getAvailableProductStock(items, products, 'prod-1', 'item-b')).toBe(3);
	});

	it('returns zero when other rows already reserved the full stock', () => {
		const items = [
			makeProductRow({ id: 'item-a', productId: 'prod-1', quantity: 4 }),
			makeProductRow({ id: 'item-b', productId: 'prod-1', quantity: 1 })
		];
		const products = [makeStockProduct('prod-1', 4)];

		expect(getAvailableProductStock(items, products, 'prod-1', 'item-b')).toBe(0);
	});
});
