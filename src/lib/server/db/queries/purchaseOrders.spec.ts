import { describe, expect, it } from 'vitest';
import { PurchaseOrderItemType } from '$lib/shared/enums';
import {
	resolvePurchaseOrderItemReviewedState,
	resolvePurchaseOrderItemZeroPriceIntentionalState
} from './purchaseOrders';

const baseItem = {
	itemType: PurchaseOrderItemType.PRODUCT,
	productId: '00000000-0000-4000-8000-000000000001',
	lensCatalogItemId: null,
	quantity: 1,
	unitPurchasePrice: 10,
	unitPurchasePriceVes: null,
	unitSalePrice: 20,
	appliesIva: true,
	ivaRate: 16
};

describe('resolvePurchaseOrderItemReviewedState', () => {
	it('preserves a reviewed check for a new draft line', () => {
		expect(resolvePurchaseOrderItemReviewedState(undefined, { isReviewed: true }, baseItem)).toBe(
			true
		);
	});

	it('preserves the previous reviewed state when an unchanged line is saved again', () => {
		expect(
			resolvePurchaseOrderItemReviewedState({ ...baseItem, isReviewed: true }, {}, baseItem)
		).toBe(true);
	});

	it('honors an explicit unreview request for an unchanged line', () => {
		expect(
			resolvePurchaseOrderItemReviewedState(
				{ ...baseItem, isReviewed: true },
				{ isReviewed: false },
				baseItem
			)
		).toBe(false);
	});

	it('clears the reviewed check when material data changes', () => {
		expect(
			resolvePurchaseOrderItemReviewedState(
				{ ...baseItem, isReviewed: true },
				{ isReviewed: true },
				{ ...baseItem, unitSalePrice: 25 }
			)
		).toBe(false);
	});
});

describe('resolvePurchaseOrderItemZeroPriceIntentionalState', () => {
	it('preserves the explicit intent for a new zero-priced draft line', () => {
		expect(
			resolvePurchaseOrderItemZeroPriceIntentionalState(
				undefined,
				{ isZeroPriceIntentional: true },
				{ ...baseItem, unitPurchasePrice: 0, unitSalePrice: 0 }
			)
		).toBe(true);
	});

	it('preserves the previous intent when the zero-priced line is unchanged', () => {
		expect(
			resolvePurchaseOrderItemZeroPriceIntentionalState(
				{ ...baseItem, unitPurchasePrice: 0, unitSalePrice: 0, isZeroPriceIntentional: true },
				{},
				{ ...baseItem, unitPurchasePrice: 0, unitSalePrice: 0 }
			)
		).toBe(true);
	});

	it('clears the intent when zero pricing no longer applies', () => {
		expect(
			resolvePurchaseOrderItemZeroPriceIntentionalState(
				{ ...baseItem, unitPurchasePrice: 0, unitSalePrice: 0, isZeroPriceIntentional: true },
				{ isZeroPriceIntentional: true },
				baseItem
			)
		).toBe(false);
	});

	it('clears the intent when the item or zero-price context changes', () => {
		expect(
			resolvePurchaseOrderItemZeroPriceIntentionalState(
				{ ...baseItem, unitPurchasePrice: 0, unitSalePrice: 0, isZeroPriceIntentional: true },
				{ isZeroPriceIntentional: true },
				{
					...baseItem,
					productId: '00000000-0000-4000-8000-000000000002',
					unitPurchasePrice: 0,
					unitSalePrice: 0
				}
			)
		).toBe(false);
	});
});
