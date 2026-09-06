import { describe, expect, it } from 'vitest';

import { DiscountType } from '$lib/shared/enums';
import type { TaxableItem } from '$lib/shared/tax';

import {
	buildTaxItemsFromWizard,
	computeAdjustedTaxBreakdown,
	computeSnapshotTaxBreakdown,
	getSnapshotTaxLabel
} from './taxBreakdown';
import { makeFreeRow, makeProductRow, makeStockProduct } from './testFixtures';

function makeTaxableItem(overrides: Partial<TaxableItem> = {}): TaxableItem {
	return {
		unitPrice: 100,
		quantity: 1,
		discount: 0,
		discountType: DiscountType.FIXED,
		isTaxable: true,
		taxRate: 16,
		...overrides
	};
}

describe('buildTaxItemsFromWizard', () => {
	it('includes free items as exempt in the wizard tax items', () => {
		const taxItems = buildTaxItemsFromWizard(
			[
				makeProductRow({ id: 'item-a', productId: 'prod-1', unitPrice: 100, quantity: 1 }),
				makeFreeRow({ id: 'item-free', unitPrice: 150, quantity: 1 })
			],
			[makeStockProduct('prod-1', 10)],
			[]
		);

		const free = taxItems.find((t) => t.unitPrice === 150);
		expect(free).toBeDefined();
		expect(free?.isTaxable).toBe(false);
		expect(free?.quantity).toBe(1);

		// Free items must not contribute to the taxable base nor the tax amount.
		const totalTaxable = taxItems.filter((t) => t.isTaxable).length;
		expect(totalTaxable).toBe(1);
	});

	it('excludes free items by default only (no isTaxable leak)', () => {
		const taxItems = buildTaxItemsFromWizard([makeFreeRow({ unitPrice: 0 })], [], []);

		expect(taxItems).toHaveLength(1);
		expect(taxItems[0]?.isTaxable).toBe(false);
		expect(taxItems[0]?.unitPrice).toBe(0);
	});
});

describe('computeAdjustedTaxBreakdown', () => {
	it('returns the tax-exclusive pre-discount subtotal for a frame + lens mix', () => {
		// User scenario: $87 taxable frame (75 base + 12 IVA) + $35 exempt lens.
		const items = [
			makeTaxableItem({ unitPrice: 87, quantity: 1, isTaxable: true, taxRate: 16 }),
			makeTaxableItem({ unitPrice: 35, quantity: 1, isTaxable: false })
		];

		const result = computeAdjustedTaxBreakdown(items, 0);

		// Subtotal row: base 75 + exempt 35 = 110 (NOT 122).
		expect(result.subtotalBeforeGlobal).toBeCloseTo(110, 2);
		expect(result.taxableBase).toBeCloseTo(75, 2);
		expect(result.exemptTotal).toBeCloseTo(35, 2);
		expect(result.taxAmount).toBeCloseTo(12, 2);
		// Pre-discount breakdown matches (no discount → same as adjusted).
		expect(result.taxableBaseBeforeDiscount).toBeCloseTo(75, 2);
		expect(result.exemptTotalBeforeDiscount).toBeCloseTo(35, 2);
		expect(result.taxAmountBeforeDiscount).toBeCloseTo(12, 2);
		// Total = BI + Exento + IVA = 75 + 35 + 12 = 122.
		expect(result.total).toBeCloseTo(122, 2);
		expect(result.subtotalBeforeGlobal + result.taxAmount).toBeCloseTo(122, 2);
	});

	it('strips IVA from the subtotal for taxable lines', () => {
		const items = [makeTaxableItem({ unitPrice: 116, quantity: 1, isTaxable: true, taxRate: 16 })];

		const result = computeAdjustedTaxBreakdown(items, 0);

		// 116 = 100 base + 16 IVA → subtotal shows 100, not 116.
		expect(result.subtotalBeforeGlobal).toBeCloseTo(100, 2);
		expect(result.taxableBase).toBeCloseTo(100, 2);
		expect(result.taxAmount).toBeCloseTo(16, 2);
		expect(result.total).toBeCloseTo(116, 2);
	});

	it('returns the pre-discount tax-exclusive subtotal when a percentage discount is applied', () => {
		const items = [
			makeTaxableItem({ unitPrice: 87, quantity: 1, isTaxable: true, taxRate: 16 }),
			makeTaxableItem({ unitPrice: 35, quantity: 1, isTaxable: false })
		];

		// 10% of raw (87 + 35 = 122) = 12.2 global discount.
		const result = computeAdjustedTaxBreakdown(items, 12.2);

		// Subtotal (pre-discount, tax-exclusive) unchanged: 110.
		expect(result.subtotalBeforeGlobal).toBeCloseTo(110, 2);
		// Pre-discount breakdown stays gross: BI 75 / Exento 35 / IVA 12.
		expect(result.taxableBaseBeforeDiscount).toBeCloseTo(75, 2);
		expect(result.exemptTotalBeforeDiscount).toBeCloseTo(35, 2);
		expect(result.taxAmountBeforeDiscount).toBeCloseTo(12, 2);
		// Total = raw 122 - 12.2 discount = 109.8.
		expect(result.total).toBeCloseTo(109.8, 2);
		expect(result.taxAmount).toBeCloseTo(12 * (1 - 0.1), 2);
		// Consistency: Total = Base + Exento + IVA (pre-discount) − Descuento.
		expect(
			result.taxableBaseBeforeDiscount +
				result.exemptTotalBeforeDiscount +
				result.taxAmountBeforeDiscount -
				12.2
		).toBeCloseTo(result.total, 2);
	});

	it('stacks per-line discounts then applies the global discount proportionally', () => {
		const items = [
			makeTaxableItem({ unitPrice: 100, discount: 10, discountType: DiscountType.FIXED }),
			makeTaxableItem({ unitPrice: 25, quantity: 2, isTaxable: false }) // exempt: 50
		];

		// Raw pre-discount: (100 - 10) + 50 = 140; 10% global → 14.
		const result = computeAdjustedTaxBreakdown(items, 14);

		// Tax-exclusive pre-discount: base(90/1.16=77.59) + 50 = 127.59.
		expect(result.subtotalBeforeGlobal).toBeCloseTo(127.59, 2);
		expect(result.total).toBeCloseTo(126, 2);
	});

	it('clamps the global discount to the raw subtotal', () => {
		const items = [makeTaxableItem({ unitPrice: 100, isTaxable: false })];

		const result = computeAdjustedTaxBreakdown(items, 99999);

		expect(result.subtotalBeforeGlobal).toBe(100);
		expect(result.total).toBe(0);
	});
});

describe('computeSnapshotTaxBreakdown', () => {
	it('uses the document tax rate for taxable persisted items', () => {
		const result = computeSnapshotTaxBreakdown(
			[
				{
					unitPrice: 116,
					quantity: 1,
					discount: 0,
					discountType: DiscountType.FIXED,
					snapshotIsTaxable: true
				},
				{
					unitPrice: 50,
					quantity: 1,
					discount: 0,
					discountType: DiscountType.FIXED,
					snapshotIsTaxable: false
				}
			],
			16
		);

		expect(result.taxableBase).toBeCloseTo(100, 2);
		expect(result.taxAmount).toBeCloseTo(16, 2);
		expect(result.exemptTotal).toBe(50);
	});

	it('treats all amounts as exempt when the document tax rate is zero', () => {
		const result = computeSnapshotTaxBreakdown(
			[
				{
					unitPrice: 100,
					quantity: 2,
					discount: 0,
					discountType: DiscountType.FIXED,
					snapshotIsTaxable: true
				}
			],
			0
		);

		expect(result.taxableBase).toBe(0);
		expect(result.taxAmount).toBe(0);
		expect(result.exemptTotal).toBe(200);
	});
});

describe('print reconstruction (discount = raw − total)', () => {
	it('reproduces the wizard breakdown from persisted rows: 82 + 28, total 60', () => {
		// Persisted rows as the print pages read them: 82 taxable (16%) + 28 exempt.
		const taxItems = [
			{
				unitPrice: 82,
				quantity: 1,
				discount: 0,
				discountType: DiscountType.FIXED,
				isTaxable: true,
				taxRate: 16
			},
			{
				unitPrice: 28,
				quantity: 1,
				discount: 0,
				discountType: DiscountType.FIXED,
				isTaxable: false,
				taxRate: 16
			}
		];
		const raw = taxItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0); // 110
		const total = 60; // stored sale.total
		const discountAmount = Math.max(0, raw - total); // 50

		const r = computeAdjustedTaxBreakdown(taxItems, discountAmount);

		expect(discountAmount).toBe(50);
		expect(r.subtotalBeforeGlobal).toBeCloseTo(98.69, 2); // 70.69 + 28
		expect(r.taxableBase).toBeCloseTo(38.56, 2);
		expect(r.exemptTotal).toBeCloseTo(15.27, 2);
		expect(r.taxAmount).toBeCloseTo(6.17, 2);
		expect(r.total).toBeCloseTo(60, 2); // == sale.total
		// discount-on-base shown in the receipt row:
		expect(r.subtotalBeforeGlobal - r.taxableBase - r.exemptTotal).toBeCloseTo(44.86, 2);
	});

	it('is a no-op for sales without discount (matches old gross display)', () => {
		const taxItems = [
			{
				unitPrice: 87,
				quantity: 1,
				discount: 0,
				discountType: DiscountType.FIXED,
				isTaxable: true,
				taxRate: 16
			},
			{
				unitPrice: 35,
				quantity: 1,
				discount: 0,
				discountType: DiscountType.FIXED,
				isTaxable: false,
				taxRate: 16
			}
		];
		const raw = 122;
		const r = computeAdjustedTaxBreakdown(taxItems, Math.max(0, raw - 122));

		expect(r.subtotalBeforeGlobal).toBeCloseTo(110, 2);
		expect(r.taxableBase).toBeCloseTo(75, 2);
		expect(r.exemptTotal).toBeCloseTo(35, 2);
		expect(r.taxAmount).toBeCloseTo(12, 2);
		expect(r.total).toBeCloseTo(122, 2);
	});
});

describe('getSnapshotTaxLabel', () => {
	it('formats a single document-level tax rate', () => {
		expect(getSnapshotTaxLabel(16)).toBe('IVA (16%)');
		expect(getSnapshotTaxLabel(8.5)).toBe('IVA (8,5%)');
	});

	it('returns null when the document tax rate is missing or zero', () => {
		expect(getSnapshotTaxLabel(null)).toBeNull();
		expect(getSnapshotTaxLabel(0)).toBeNull();
	});
});
