import { describe, expect, it } from 'vitest';

import {
	allowsDuplicateProductLines,
	canAutoIncludeAccessories,
	linkIncludedAccessories,
	pruneIncludedAccessoryMap,
	removeItemWithIncludedAccessories,
	syncIncludedAccessoryQuantities,
	type IncludedAccessoryMap
} from './includedAccessories';
import { DiscountType } from '$lib/shared/enums';
import type { ProductSaleItemRow } from './newSaleTypes';

function createProductRow(
	id: string,
	productId: string,
	parentItemId: string | null = null
): ProductSaleItemRow {
	return {
		id,
		kind: 'product',
		productId,
		quantity: 1,
		unitPrice: 0,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		isIncludedAccessory: parentItemId !== null,
		includedAccessoryParentItemId: parentItemId
	};
}

describe('includedAccessories helpers', () => {
	it('allows auto inclusion only for frames and sunglasses', () => {
		expect(canAutoIncludeAccessories('FRAME')).toBe(true);
		expect(canAutoIncludeAccessories('SUNGLASSES')).toBe(true);
		expect(canAutoIncludeAccessories('ACCESSORY')).toBe(false);
		expect(canAutoIncludeAccessories('CONTACT_LENS')).toBe(false);
	});

	it('allows duplicate quick-add lines only for accessories', () => {
		expect(allowsDuplicateProductLines('ACCESSORY')).toBe(true);
		expect(allowsDuplicateProductLines('FRAME')).toBe(false);
	});

	it('links and prunes accessory ids against valid items', () => {
		const linked = linkIncludedAccessories({}, 'frame-1', ['case-1', 'cloth-1']);
		const pruned = pruneIncludedAccessoryMap(linked, ['frame-1', 'case-1']);

		expect(linked).toEqual({ 'frame-1': ['case-1', 'cloth-1'] });
		expect(pruned).toEqual({ 'frame-1': ['case-1'] });
	});

	it('removes a parent item together with its included accessories', () => {
		const items = [
			createProductRow('frame-1', 'product-frame'),
			createProductRow('case-1', 'product-case', 'frame-1'),
			createProductRow('cloth-1', 'product-cloth', 'frame-1'),
			createProductRow('manual-1', 'product-manual')
		];
		const map: IncludedAccessoryMap = { 'frame-1': ['case-1', 'cloth-1'] };

		const result = removeItemWithIncludedAccessories(items, map, 'frame-1');

		expect(result.items.map((item) => item.id)).toEqual(['manual-1']);
		expect(result.includedAccessoryMap).toEqual({});
	});

	it('removes only the selected accessory when seller deletes it manually', () => {
		const items = [
			createProductRow('frame-1', 'product-frame'),
			createProductRow('case-1', 'product-case', 'frame-1'),
			createProductRow('cloth-1', 'product-cloth', 'frame-1')
		];
		const map: IncludedAccessoryMap = { 'frame-1': ['case-1', 'cloth-1'] };

		const result = removeItemWithIncludedAccessories(items, map, 'case-1');

		expect(result.items.map((item) => item.id)).toEqual(['frame-1', 'cloth-1']);
		expect(result.includedAccessoryMap).toEqual({ 'frame-1': ['cloth-1'] });
	});

	it('syncs linked accessory quantities up and down when parent quantity changes', () => {
		const items = [
			createProductRow('frame-1', 'product-frame'),
			createProductRow('case-1', 'product-case', 'frame-1'),
			createProductRow('manual-1', 'product-manual')
		];
		const map: IncludedAccessoryMap = { 'frame-1': ['case-1'] };

		const up = syncIncludedAccessoryQuantities(items, map, 'frame-1', 3);
		expect(up.cappedIds).toEqual([]);
		expect(up.items.find((i) => i.id === 'case-1')?.quantity).toBe(3);
		expect(up.items.find((i) => i.id === 'manual-1')?.quantity).toBe(1);

		const down = syncIncludedAccessoryQuantities(up.items, map, 'frame-1', 1);
		expect(down.items.find((i) => i.id === 'case-1')?.quantity).toBe(1);
	});

	it('clamps synced accessory quantity to available stock and reports capped ids', () => {
		const items = [
			createProductRow('frame-1', 'product-frame'),
			createProductRow('case-1', 'product-case', 'frame-1')
		];
		const map: IncludedAccessoryMap = { 'frame-1': ['case-1'] };

		const result = syncIncludedAccessoryQuantities(items, map, 'frame-1', 4, (pid) =>
			pid === 'product-case' ? 2 : 10
		);
		expect(result.items.find((i) => i.id === 'case-1')?.quantity).toBe(2);
		expect(result.cappedIds).toEqual(['case-1']);
	});

	it('ignores invalid or zero parent quantities during typing', () => {
		const items = [
			createProductRow('frame-1', 'product-frame'),
			createProductRow('case-1', 'product-case', 'frame-1')
		];
		const map: IncludedAccessoryMap = { 'frame-1': ['case-1'] };

		const result = syncIncludedAccessoryQuantities(items, map, 'frame-1', Number.NaN);
		expect(result.items).toBe(items);
		expect(result.cappedIds).toEqual([]);
	});
});
