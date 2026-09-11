import { describe, expect, it } from 'vitest';
import type { InventoryCountLineRow } from '$lib/server/db/queries/inventoryCount';
import {
	differenceBadgeClass,
	formatDifference,
	getAdjustmentPath,
	hasDifference,
	isAdjustmentStatusUpdating,
	isMatchedLine,
	toggleUpdatingId
} from './countAdjustments';

function line(overrides: Partial<InventoryCountLineRow> = {}): InventoryCountLineRow {
	return {
		id: 1,
		countedStock: null,
		difference: null,
		adjustmentCompleted: false,
		itemType: 'PRODUCT',
		productId: 'prod-1',
		lensCatalogItemId: null,
		itemName: 'Montura X',
		itemCode: 'SKU-1',
		itemDetail: null,
		systemStock: 5,
		...overrides
	} as InventoryCountLineRow;
}

describe('count line diff predicates', () => {
	it('detects difference only when counted and nonzero', () => {
		expect(hasDifference(line({ countedStock: 7, difference: 2 }))).toBe(true);
		expect(hasDifference(line({ countedStock: null, difference: null }))).toBe(false);
		expect(hasDifference(line({ countedStock: 5, difference: 0 }))).toBe(false);
	});

	it('detects matched lines only when counted and zero', () => {
		expect(isMatchedLine(line({ countedStock: 5, difference: 0 }))).toBe(true);
		expect(isMatchedLine(line({ countedStock: null, difference: null }))).toBe(false);
		expect(isMatchedLine(line({ countedStock: 7, difference: 2 }))).toBe(false);
	});
});

describe('getAdjustmentPath', () => {
	it('builds product and lens paths', () => {
		expect(
			getAdjustmentPath(
				line({ countedStock: 7, difference: 2, itemType: 'PRODUCT', productId: 'p-9' })
			)
		).toBe('/products/p-9/adjustments');
		expect(
			getAdjustmentPath(
				line({
					countedStock: 1,
					difference: -1,
					itemType: 'LENS',
					productId: null,
					lensCatalogItemId: 'l-3'
				})
			)
		).toBe('/lenses/l-3/adjustments');
	});

	it('returns null without difference or without item id', () => {
		expect(getAdjustmentPath(line({ countedStock: 5, difference: 0 }))).toBeNull();
		expect(
			getAdjustmentPath(
				line({ countedStock: 7, difference: 2, productId: null, lensCatalogItemId: null })
			)
		).toBeNull();
	});
});

describe('difference formatting', () => {
	it('formats null and zero as em dash', () => {
		expect(formatDifference(null)).toBe('—');
		expect(formatDifference(0)).toBe('—');
		expect(formatDifference(3)).toBe('+3');
		expect(formatDifference(-2)).toBe('-2');
	});

	it('assigns badge classes by tone', () => {
		expect(differenceBadgeClass(null)).toContain('bg-surface-container');
		expect(differenceBadgeClass(0)).toContain('bg-surface-container');
		expect(differenceBadgeClass(4)).toContain('bg-success-container');
		expect(differenceBadgeClass(-4)).toContain('bg-error-container');
	});
});

describe('adjustment updating tracking', () => {
	it('tracks updating ids immutably', () => {
		expect(isAdjustmentStatusUpdating(2, [1, 2])).toBe(true);
		expect(isAdjustmentStatusUpdating(3, [1, 2])).toBe(false);
		expect(toggleUpdatingId([1], 2, true)).toEqual([1, 2]);
		expect(toggleUpdatingId([1, 2], 2, false)).toEqual([1]);
	});
});
