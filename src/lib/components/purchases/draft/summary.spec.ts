import { describe, expect, it } from 'vitest';

import { PurchaseDiscountType, PurchaseOrderItemType } from '$lib/shared/enums';

import {
	applyLensDefaults,
	applyProductDefaults,
	createEmptyPurchaseOrderDraftItem
} from './defaults';
import { calculateDraftItemTotal, calculateUnitPurchasePriceFromLineTotal } from './pricing';
import {
	applySettlementDiscount,
	calculatePurchaseOrderSummary,
	getSettlementDiscountFactor,
	prorateNetUnitPurchasePrice
} from './summary';
import { makeLens, makeProduct } from './testFixtures';

describe('calculatePurchaseOrderSummary', () => {
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

	it('returns direct Bs summary totals when rows store per-line Bs prices', () => {
		const first = createEmptyPurchaseOrderDraftItem();
		first.appliesIva = true;
		first.ivaRate = 16;
		first.quantity = 2;
		first.unitPurchasePriceAlt = 3.14;
		first.unitPurchasePrice = (first.unitPurchasePriceAlt * 1.16) / 100;

		const second = createEmptyPurchaseOrderDraftItem();
		second.appliesIva = true;
		second.ivaRate = 16;
		second.quantity = 1;
		second.unitPurchasePriceAlt = 6.27;
		second.unitPurchasePrice = (second.unitPurchasePriceAlt * 1.16) / 100;

		const third = createEmptyPurchaseOrderDraftItem();
		third.appliesIva = true;
		third.ivaRate = 16;
		third.quantity = 1;
		third.unitPurchasePriceAlt = 9.43;
		third.unitPurchasePrice = (third.unitPurchasePriceAlt * 1.16) / 100;

		const summary = calculatePurchaseOrderSummary([first, second, third], undefined, 100);

		expect(summary.subtotalAlt).toBe(21.98);
		expect(summary.taxAmountAlt).toBe(3.51);
		expect(summary.totalAlt).toBe(25.49);
		expect(summary.netTotalAlt).toBe(25.49);
		expect(Number((summary.total * 100).toFixed(2))).toBe(25.5);
		expect(summary.totalAlt).not.toBe(Number((summary.total * 100).toFixed(2)));
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
