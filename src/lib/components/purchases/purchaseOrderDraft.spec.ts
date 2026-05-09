import { describe, expect, it } from 'vitest';

import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import type { PurchaseOrderItemWithProduct } from '$lib/server/db/queries/purchaseOrders';
import type { ProductWithRelations } from '$lib/server/db/queries/products';
import {
	PurchaseDiscountType,
	PurchaseDocumentType,
	PurchaseOrderItemType
} from '$lib/shared/enums';
import { LensPriceType, LensType } from '$lib/shared/enums/lensTypes';

import {
	applyLensDefaults,
	applyProductDefaults,
	applySettlementDiscount,
	calculateDraftItemTotal,
	calculateUnitPurchasePriceFromLineTotal,
	calculatePurchaseOrderSummary,
	canPersistPurchaseOrderDraft,
	createEmptyPurchaseOrderDraftItem,
	createPurchaseOrderDraftItemFromExisting,
	getDraftItemZeroValueFields,
	getPurchaseOrderReviewStatus,
	getSettlementDiscountFactor,
	prorateNetUnitPurchasePrice
} from './purchaseOrderDraft';

function makeProduct(overrides: Partial<ProductWithRelations> = {}): ProductWithRelations {
	return {
		id: 'product-1',
		sku: 'MON-001',
		name: 'Montura acetato',
		currentPurchasePrice: 18,
		currentSalePrice: 42,
		isTaxable: true,
		supplierId: 'supplier-1',
		brand: { name: 'Optikt' },
		supplier: { name: 'Distribuidora Norte' },
		...overrides
	} as ProductWithRelations;
}

function makeLens(
	overrides: Partial<LensCatalogItemWithRelations> = {}
): LensCatalogItemWithRelations {
	return {
		id: 'lens-1',
		name: 'Blue Cut 1.56',
		type: LensType.MONOFOCAL,
		priceType: LensPriceType.PAIR,
		pairPurchasePrice: 24,
		basePrice: 14,
		salePrice: 52,
		isTaxable: false,
		supplierId: 'supplier-1',
		material: { name: 'CR-39' },
		supplier: { name: 'Lab Express' },
		...overrides
	} as LensCatalogItemWithRelations;
}

describe('purchaseOrderDraft helpers', () => {
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

	it('calculates the draft summary totals', () => {
		const productItem = createEmptyPurchaseOrderDraftItem();
		applyProductDefaults(
			productItem,
			makeProduct({ currentPurchasePrice: 10, currentSalePrice: 25 })
		);
		productItem.quantity = 2;

		const lensItem = createEmptyPurchaseOrderDraftItem(PurchaseOrderItemType.LENS);
		applyLensDefaults(
			lensItem,
			makeLens({ pairPurchasePrice: 30, salePrice: 60, isTaxable: false })
		);
		lensItem.quantity = 1;

		const summary = calculatePurchaseOrderSummary([productItem, lensItem]);

		expect(summary.lineCount).toBe(2);
		expect(summary.totalUnits).toBe(3);
		expect(summary.subtotal).toBe(50);
		expect(summary.taxAmount).toBeCloseTo(3.2);
		expect(summary.total).toBeCloseTo(53.2);
		expect(summary.estimatedSale).toBe(110);
		expect(summary.estimatedProfit).toBeCloseTo(56.8);
	});

	it('derives precise unit purchase price from total cost and quantity', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		item.quantity = 36;
		item.unitPurchasePrice = calculateUnitPurchasePriceFromLineTotal(25, item.quantity);

		expect(item.unitPurchasePrice).toBeCloseTo(25 / 36, 12);
		expect(calculateDraftItemTotal(item)).toBeCloseTo(25, 12);
	});

	it('keeps taxable summary total aligned with an entered line total', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		item.quantity = 36;
		item.appliesIva = true;
		item.ivaRate = 16;
		item.unitPurchasePrice = calculateUnitPurchasePriceFromLineTotal(25, item.quantity);

		const summary = calculatePurchaseOrderSummary([item]);

		expect(calculateDraftItemTotal(item)).toBeCloseTo(25, 12);
		expect(summary.total).toBeCloseTo(25, 12);
		expect(summary.subtotal + summary.taxAmount).toBeCloseTo(summary.total, 12);
	});

	it('flags draft items with zero cost or zero sale price', () => {
		const item = createEmptyPurchaseOrderDraftItem();

		expect(getDraftItemZeroValueFields(item)).toEqual(['unitPurchasePrice', 'unitSalePrice']);

		item.unitPurchasePrice = 12;
		expect(getDraftItemZeroValueFields(item)).toEqual(['unitSalePrice']);

		item.unitSalePrice = 20;
		expect(getDraftItemZeroValueFields(item)).toEqual([]);
	});

	it('hydrates existing purchase order item ids for edit saves', () => {
		const item = createPurchaseOrderDraftItemFromExisting({
			id: 'po-item-1',
			itemType: PurchaseOrderItemType.PRODUCT,
			productId: 'product-1',
			lensCatalogItemId: null,
			quantity: 3,
			unitPurchasePrice: 11,
			unitSalePrice: 25,
			appliesIva: true,
			ivaRate: 16
		} as PurchaseOrderItemWithProduct);

		expect(item.id).toBe('po-item-1');
		expect(item.persistedId).toBe('po-item-1');
		expect(item.productId).toBe('product-1');
	});

	it('starts new draft items as not reviewed', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		expect(item.isReviewed).toBe(false);
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

	it('counts reviewed and pending draft items', () => {
		const first = createEmptyPurchaseOrderDraftItem();
		const second = createEmptyPurchaseOrderDraftItem();
		first.isReviewed = true;

		expect(getPurchaseOrderReviewStatus([first, second])).toEqual({
			totalCount: 2,
			reviewedCount: 1,
			pendingCount: 1,
			allReviewed: false
		});

		second.isReviewed = true;

		expect(getPurchaseOrderReviewStatus([first, second]).allReviewed).toBe(true);
	});

	it('validates whether a draft can be persisted', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		item.productId = 'product-1';
		item.unitPurchasePrice = 0;
		item.unitSalePrice = 0;

		expect(
			canPersistPurchaseOrderDraft(
				{
					supplierId: 'supplier-1',
					orderDate: '2025-01-15',
					bcvRate: 65,
					notes: 'Compra de prueba'
				},
				[item]
			)
		).toBe(true);
	});
});

describe('settlement discount helpers', () => {
	it('returns 0 for NONE discount', () => {
		expect(applySettlementDiscount(223, { type: PurchaseDiscountType.NONE, value: 0 })).toBe(0);
		expect(getSettlementDiscountFactor(223, { type: PurchaseDiscountType.NONE, value: 0 })).toBe(1);
	});

	it('applies a percentage discount on the gross subtotal', () => {
		const amount = applySettlementDiscount(223, {
			type: PurchaseDiscountType.PERCENT,
			value: 5
		});
		expect(amount).toBeCloseTo(11.15, 2);

		const factor = getSettlementDiscountFactor(223, {
			type: PurchaseDiscountType.PERCENT,
			value: 5
		});
		expect(factor).toBeCloseTo(0.95, 4);
	});

	it('applies a fixed amount discount capped at the subtotal', () => {
		expect(
			applySettlementDiscount(223, { type: PurchaseDiscountType.AMOUNT, value: 11.15 })
		).toBeCloseTo(11.15, 2);
		expect(applySettlementDiscount(50, { type: PurchaseDiscountType.AMOUNT, value: 100 })).toBe(50);
	});

	it('prorates the per-unit price using the discount factor', () => {
		const factor = getSettlementDiscountFactor(223, {
			type: PurchaseDiscountType.PERCENT,
			value: 5
		});
		expect(prorateNetUnitPurchasePrice(20, factor)).toBeCloseTo(19, 2);
	});

	it('returns net totals matching the user invoice example (5% on $223 with 16% IVA)', () => {
		// Single line, exempt of IVA on inventory side just to isolate gross math.
		const item = createEmptyPurchaseOrderDraftItem();
		item.appliesIva = false;
		item.ivaRate = 0;
		item.quantity = 1;
		item.unitPurchasePrice = 223;

		const summary = calculatePurchaseOrderSummary([item], {
			type: PurchaseDiscountType.PERCENT,
			value: 5
		});

		expect(summary.subtotal).toBeCloseTo(223, 2);
		expect(summary.discountAmount).toBeCloseTo(11.15, 2);
		expect(summary.netSubtotal).toBeCloseTo(211.85, 2);
		expect(summary.netTaxAmount).toBeCloseTo(0, 2);
		expect(summary.netTotal).toBeCloseTo(211.85, 2);
	});

	it('reduces IVA proportionally to the discount on taxable lines', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		// Pre-tax unit = 100, IVA 16% => unitPurchasePrice = 116
		item.appliesIva = true;
		item.ivaRate = 16;
		item.quantity = 1;
		item.unitPurchasePrice = 116;

		const summary = calculatePurchaseOrderSummary([item], {
			type: PurchaseDiscountType.PERCENT,
			value: 5
		});

		// Gross subtotal pre-tax = 100, IVA = 16
		expect(summary.subtotal).toBeCloseTo(100, 2);
		expect(summary.taxAmount).toBeCloseTo(16, 2);
		// Discount applies to pre-tax base only
		expect(summary.discountAmount).toBeCloseTo(5, 2);
		expect(summary.netSubtotal).toBeCloseTo(95, 2);
		// IVA on net base = 95 * 16% = 15.2
		expect(summary.netTaxAmount).toBeCloseTo(15.2, 2);
		expect(summary.netTotal).toBeCloseTo(110.2, 2);
	});

	it('handles mixed taxable and exempt lines with a percentage discount', () => {
		const taxable = createEmptyPurchaseOrderDraftItem();
		taxable.appliesIva = true;
		taxable.ivaRate = 16;
		taxable.quantity = 1;
		taxable.unitPurchasePrice = 116; // pre-tax 100

		const exempt = createEmptyPurchaseOrderDraftItem();
		exempt.appliesIva = false;
		exempt.ivaRate = 0;
		exempt.quantity = 1;
		exempt.unitPurchasePrice = 50;

		const summary = calculatePurchaseOrderSummary([taxable, exempt], {
			type: PurchaseDiscountType.PERCENT,
			value: 10
		});

		// Pre-tax subtotal = 150
		expect(summary.subtotal).toBeCloseTo(150, 2);
		expect(summary.discountAmount).toBeCloseTo(15, 2);
		expect(summary.netSubtotal).toBeCloseTo(135, 2);
		// IVA only from the taxable line at net rate: 100 * 0.9 * 0.16 = 14.4
		expect(summary.netTaxAmount).toBeCloseTo(14.4, 2);
		expect(summary.netTotal).toBeCloseTo(149.4, 2);
	});

	it('falls back to gross totals when no discount is provided', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		item.appliesIva = false;
		item.ivaRate = 0;
		item.quantity = 1;
		item.unitPurchasePrice = 100;

		const summary = calculatePurchaseOrderSummary([item]);
		expect(summary.discountAmount).toBe(0);
		expect(summary.netTotal).toBeCloseTo(summary.total, 2);
	});
});
