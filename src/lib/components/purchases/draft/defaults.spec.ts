import { describe, expect, it } from 'vitest';

import type { PurchaseOrderItemWithProduct } from '$lib/server/db/queries/purchaseOrders';
import { PurchaseDocumentType, PurchaseOrderItemType } from '$lib/shared/enums';

import {
	applyLensDefaults,
	applyProductDefaults,
	createEmptyPurchaseOrderDraftItem,
	createPurchaseOrderDraftItemFromExisting,
	getDraftItemZeroValueFields
} from './defaults';
import { makeLens, makeProduct } from './testFixtures';

describe('createEmptyPurchaseOrderDraftItem', () => {
	it('creates a product draft row by default', () => {
		const item = createEmptyPurchaseOrderDraftItem();

		expect(item.itemType).toBe(PurchaseOrderItemType.PRODUCT);
		expect(item.quantity).toBe(1);
		expect(item.appliesIva).toBe(true);
		expect(item.ivaRate).toBe(16);
	});

	it('creates an exempt draft row for delivery note', () => {
		const item = createEmptyPurchaseOrderDraftItem(
			PurchaseOrderItemType.PRODUCT,
			PurchaseDocumentType.DELIVERY_NOTE
		);

		expect(item.appliesIva).toBe(false);
		expect(item.ivaRate).toBe(16);
	});
});

describe('applyProductDefaults', () => {
	it('hydrates product defaults into a draft row', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		applyProductDefaults(item, makeProduct());

		expect(item.productId).toBe('product-1');
		expect(item.lensCatalogItemId).toBe('');
		expect(item.unitPurchasePrice).toBe(20.88);
		expect(item.unitSalePrice).toBe(42);
		expect(item.appliesIva).toBe(true);
		expect(item.ivaRate).toBe(16);
	});

	it('hydrates product defaults as exempt for delivery note', () => {
		const item = createEmptyPurchaseOrderDraftItem(
			PurchaseOrderItemType.PRODUCT,
			PurchaseDocumentType.DELIVERY_NOTE
		);
		applyProductDefaults(
			item,
			makeProduct({ isTaxable: true }),
			PurchaseDocumentType.DELIVERY_NOTE
		);

		expect(item.appliesIva).toBe(false);
	});
});

describe('applyLensDefaults', () => {
	it('hydrates lens defaults using pair purchase price when applicable', () => {
		const item = createEmptyPurchaseOrderDraftItem(PurchaseOrderItemType.LENS);
		applyLensDefaults(item, makeLens());

		expect(item.itemType).toBe(PurchaseOrderItemType.LENS);
		expect(item.productId).toBe('');
		expect(item.lensCatalogItemId).toBe('lens-1');
		expect(item.unitPurchasePrice).toBe(24);
		expect(item.unitSalePrice).toBe(52);
		expect(item.appliesIva).toBe(false);
	});
});

describe('createPurchaseOrderDraftItemFromExisting', () => {
	it('hydrates existing purchase order item ids for edit saves', () => {
		const item = createPurchaseOrderDraftItemFromExisting({
			id: 'po-item-1',
			itemType: PurchaseOrderItemType.PRODUCT,
			productId: 'product-1',
			lensCatalogItemId: null,
			quantity: 3,
			unitPurchasePrice: 11,
			unitPurchasePriceAlt: 702.15,
			unitSalePrice: 25,
			isZeroPriceIntentional: true,
			appliesIva: true,
			ivaRate: 16
		} as PurchaseOrderItemWithProduct);

		expect(item.id).toBe('po-item-1');
		expect(item.persistedId).toBe('po-item-1');
		expect(item.productId).toBe('product-1');
		expect(item.isZeroPriceIntentional).toBe(true);
		expect(item.unitPurchasePriceAlt).toBe(702.15);
	});

	it('hydrates the reviewed flag from an existing item', () => {
		const reviewed = createPurchaseOrderDraftItemFromExisting({
			id: 'po-item-1',
			itemType: PurchaseOrderItemType.PRODUCT,
			productId: 'product-1',
			lensCatalogItemId: null,
			quantity: 1,
			unitPurchasePrice: 10,
			unitSalePrice: 20,
			appliesIva: true,
			ivaRate: 16,
			isReviewed: true
		} as PurchaseOrderItemWithProduct);
		expect(reviewed.isReviewed).toBe(true);

		const unreviewed = createPurchaseOrderDraftItemFromExisting({
			id: 'po-item-2',
			itemType: PurchaseOrderItemType.PRODUCT,
			productId: 'product-2',
			lensCatalogItemId: null,
			quantity: 1,
			unitPurchasePrice: 10,
			unitSalePrice: 20,
			appliesIva: true,
			ivaRate: 16
		} as PurchaseOrderItemWithProduct);
		expect(unreviewed.isReviewed).toBe(false);
	});

	it('starts new draft items as not reviewed', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		expect(item.isReviewed).toBe(false);
	});
});

describe('getDraftItemZeroValueFields', () => {
	it('flags draft items with zero cost or zero sale price', () => {
		const item = createEmptyPurchaseOrderDraftItem();

		expect(getDraftItemZeroValueFields(item)).toEqual(['unitPurchasePrice', 'unitSalePrice']);

		item.unitPurchasePrice = 12;
		expect(getDraftItemZeroValueFields(item)).toEqual(['unitSalePrice']);

		item.unitSalePrice = 20;
		expect(getDraftItemZeroValueFields(item)).toEqual([]);
	});

	it('suppresses zero-price warnings when the line is explicitly marked as intentional', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		item.isZeroPriceIntentional = true;

		expect(getDraftItemZeroValueFields(item)).toEqual([]);
	});
});
