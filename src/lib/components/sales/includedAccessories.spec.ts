import { describe, expect, it } from 'vitest';

import {
	allowsDuplicateProductLines,
	canAutoIncludeAccessories,
	linkIncludedAccessories,
	pruneIncludedAccessoryMap,
	removeItemWithIncludedAccessories,
	type IncludedAccessoryMap
} from './includedAccessories';
import { DiscountType } from '$lib/shared/enums';
import type { SaleItemRow } from './newSaleTypes';

function createProductRow(id: string, productId: string, parentItemId: string | null = null): any {
	return {
		id,
		kind: 'product',
		productId,
		quantity: 1,
		unitPrice: 0,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		costOverrides: { baseCost: 0, mountingPrice: 0, shippingPrice: 0 },
		shippingCostPending: false,
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
});
