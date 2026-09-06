import { describe, expect, it } from 'vitest';

import { DiscountType } from '$lib/shared/enums';

import type { SaleItemRow, LensSaleItemRow } from '../newSaleTypes';
import {
	calculateSaleSummarySubtotal,
	computeItemDiscount,
	getItemDiscountMax,
	isItemDiscountValid,
	itemLineTotal,
	step2ItemLineTotal
} from './pricing';
import { makeLensRow, makeProductRow, makeTreatment, makeTreatmentRow } from './testFixtures';

describe('itemLineTotal', () => {
	it('computes product line total correctly', () => {
		expect(itemLineTotal(makeProductRow({ unitPrice: 85, quantity: 2 }))).toBe(170);
	});

	it('applies fixed discount on product', () => {
		expect(itemLineTotal(makeProductRow({ unitPrice: 100, quantity: 1, discount: 10 }))).toBe(90);
	});

	it('applies percentage discount on product', () => {
		expect(
			itemLineTotal(
				makeProductRow({
					unitPrice: 200,
					quantity: 1,
					discount: 10,
					discountType: DiscountType.PERCENTAGE
				})
			)
		).toBe(180);
	});

	it('computes lens line total (qty always 1)', () => {
		const lens = makeLensRow();
		lens.unitPrice = 80;
		expect(itemLineTotal(lens)).toBe(80);
	});

	it('handles zero price', () => {
		expect(itemLineTotal(makeProductRow({ unitPrice: 0 }))).toBe(0);
	});

	it('clamps fixed discount to the row total for display calculations', () => {
		expect(itemLineTotal(makeProductRow({ unitPrice: 30, quantity: 1, discount: 50 }))).toBe(0);
	});

	it('clamps percentage discount above 100% for display calculations', () => {
		expect(
			itemLineTotal(
				makeProductRow({
					unitPrice: 30,
					quantity: 1,
					discount: 200,
					discountType: DiscountType.PERCENTAGE
				})
			)
		).toBe(0);
	});
});

describe('step2ItemLineTotal', () => {
	it('ignores discounts for product rows in Step 2', () => {
		expect(
			step2ItemLineTotal(
				makeProductRow({
					unitPrice: 120,
					quantity: 2,
					discount: 25,
					discountType: DiscountType.FIXED
				})
			)
		).toBe(240);
	});

	it('uses a single quantity for lens rows', () => {
		const lens = makeLensRow();
		lens.unitPrice = 95;

		expect(step2ItemLineTotal(lens)).toBe(95);
	});
});

describe('treatmentsTotal', () => {
	// This function is defined inline in Step 2 and Step 3 - test the logic here
	function treatmentsTotal(item: LensSaleItemRow): number {
		return item.treatments.reduce((sum: number, t: { price: number }) => sum + t.price, 0);
	}

	it('returns 0 when no treatments', () => {
		expect(treatmentsTotal(makeLensRow())).toBe(0);
	});

	it('sums single treatment', () => {
		expect(treatmentsTotal(makeLensRow([makeTreatment(15)]))).toBe(15);
	});

	it('sums multiple treatments', () => {
		const treatments = [makeTreatment(15, 'AR Angel'), makeTreatment(8, 'Bluecut')];
		expect(treatmentsTotal(makeLensRow(treatments))).toBe(23);
	});
});

describe('subtotal (Step 3)', () => {
	// Note: item.unitPrice for lenses is set by recalcSuggestedPrice which
	// already includes treatments. The subtotal is just sum(itemLineTotal).
	function subtotal(items: SaleItemRow[]): number {
		return items.reduce((acc: number, item) => acc + itemLineTotal(item), 0);
	}

	it('computes subtotal with product only', () => {
		const items = [makeProductRow({ unitPrice: 85, quantity: 2 })];
		expect(subtotal(items)).toBe(170);
	});

	it('computes subtotal with lens (unitPrice includes treatments)', () => {
		// unitPrice = basePrice + mounting + shipping + treatments = 50 + 15 + 8
		const lens = makeLensRow([makeTreatment(15), makeTreatment(8)]);
		lens.unitPrice = 73; // already includes treatments
		expect(subtotal([lens])).toBe(73);
	});

	it('computes subtotal with product + lens', () => {
		const product = makeProductRow({ unitPrice: 85, quantity: 1 });
		const lens = makeLensRow([makeTreatment(15)]);
		lens.unitPrice = 65; // already includes treatment
		expect(subtotal([product, lens])).toBe(85 + 65);
	});

	it('applies discount to full lens unitPrice (which includes treatments)', () => {
		const lens = makeLensRow([makeTreatment(15)]);
		lens.unitPrice = 115; // base cost + treatment already included
		lens.discount = 10;
		lens.discountType = DiscountType.FIXED;
		// itemLineTotal = 115 - 10 = 105
		expect(subtotal([lens])).toBe(105);
	});
});

describe('computeItemDiscount', () => {
	it('returns 0 when discount is 0', () => {
		expect(computeItemDiscount(makeProductRow())).toBe(0);
	});

	it('returns fixed discount amount', () => {
		expect(computeItemDiscount(makeProductRow({ discount: 15 }))).toBe(15);
	});

	it('returns percentage based on line total', () => {
		expect(
			computeItemDiscount(
				makeProductRow({
					unitPrice: 200,
					quantity: 2,
					discount: 10,
					discountType: DiscountType.PERCENTAGE
				})
			)
		).toBe(40); // 10% of 400
	});

	it('flags fixed discounts above the row total as invalid', () => {
		expect(isItemDiscountValid(makeProductRow({ unitPrice: 30, discount: 50 }))).toBe(false);
		expect(getItemDiscountMax(makeProductRow({ unitPrice: 30, discount: 50 }))).toBe(30);
	});

	it('flags percentage discounts above 100 as invalid', () => {
		expect(
			isItemDiscountValid(makeProductRow({ discount: 120, discountType: DiscountType.PERCENTAGE }))
		).toBe(false);
		expect(
			getItemDiscountMax(makeProductRow({ discount: 120, discountType: DiscountType.PERCENTAGE }))
		).toBe(100);
	});
});

describe('calculateSaleSummarySubtotal', () => {
	it('sums itemLineTotal across all items including treatments', () => {
		const product = makeProductRow({ unitPrice: 30, discount: 50 });
		const lens = makeLensRow([makeTreatment(15)]);
		lens.unitPrice = 25;
		const treatment = makeTreatmentRow(lens.id, 15, 2);

		expect(calculateSaleSummarySubtotal([product, lens, treatment])).toBe(55);
	});
});
