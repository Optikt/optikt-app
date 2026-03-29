import { describe, it, expect } from 'vitest';
import { itemLineTotal, computeItemDiscount } from './saleItemHelpers';
import { DiscountType } from '$lib/shared/enums';
import type { SaleItemRow, SelectedTreatment } from './newSaleTypes';
import { createEmptyLensPair } from './newSaleTypes';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeProductRow(overrides: Partial<SaleItemRow> = {}): SaleItemRow {
	return {
		id: 'item-1',
		kind: 'product',
		productId: 'prod-1',
		quantity: 1,
		lensPair: null,
		treatments: [],
		unitPrice: 100,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		...overrides
	};
}

function makeLensRow(treatments: SelectedTreatment[] = []): SaleItemRow {
	const pair = createEmptyLensPair();
	pair.catalogItemId = 'lens-1';
	return {
		id: 'item-2',
		kind: 'lens',
		productId: '',
		quantity: 1,
		lensPair: pair,
		treatments,
		unitPrice: 50,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: ''
	};
}

function makeTreatment(price: number, name = 'AR Angel'): SelectedTreatment {
	return {
		supplierTreatmentId: crypto.randomUUID(),
		name,
		category: 'AR',
		price
	};
}

// ── itemLineTotal (excludes treatments — they are separate) ─────────────

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
});

// ── treatmentsTotal (used in Step 2 and Step 3) ─────────────────────────

describe('treatmentsTotal', () => {
	// This function is defined inline in Step 2 and Step 3 — test the logic here
	function treatmentsTotal(item: SaleItemRow): number {
		return item.treatments.reduce((sum, t) => sum + t.price, 0);
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

// ── Full subtotal including treatments (Step 3 logic) ───────────────────

describe('subtotal with treatments', () => {
	function treatmentsTotal(item: SaleItemRow): number {
		return item.treatments.reduce((sum, t) => sum + t.price, 0);
	}

	function subtotal(items: SaleItemRow[]): number {
		return items.reduce((acc, item) => acc + itemLineTotal(item) + treatmentsTotal(item), 0);
	}

	it('computes subtotal with product only', () => {
		const items = [makeProductRow({ unitPrice: 85, quantity: 2 })];
		expect(subtotal(items)).toBe(170);
	});

	it('computes subtotal with lens + treatments', () => {
		const lens = makeLensRow([makeTreatment(15), makeTreatment(8)]);
		lens.unitPrice = 50;
		expect(subtotal([lens])).toBe(50 + 15 + 8);
	});

	it('computes subtotal with product + lens + treatments', () => {
		const product = makeProductRow({ unitPrice: 85, quantity: 1 });
		const lens = makeLensRow([makeTreatment(15)]);
		lens.unitPrice = 50;
		expect(subtotal([product, lens])).toBe(85 + 50 + 15);
	});

	it('applies discount only to item line, not treatments', () => {
		const lens = makeLensRow([makeTreatment(15)]);
		lens.unitPrice = 100;
		lens.discount = 10;
		lens.discountType = DiscountType.FIXED;
		// itemLineTotal = 100 - 10 = 90, treatments = 15
		expect(subtotal([lens])).toBe(90 + 15);
	});
});

// ── computeItemDiscount ─────────────────────────────────────────────────

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
});
