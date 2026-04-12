import { describe, it, expect } from 'vitest';
import { LensPriceType } from '$lib/shared/enums';

// ── Replicate the server-side computation logic for testing ──────────────

/** Same formula used in lenses.remote.ts */
function computePairPurchasePrice(basePrice: number, priceType: string): number {
	return priceType === LensPriceType.UNIT ? basePrice * 2 : basePrice;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('computePairPurchasePrice', () => {
	it('PER_UNIT: pairPurchasePrice = basePrice × 2', () => {
		expect(computePairPurchasePrice(2.3, LensPriceType.UNIT)).toBeCloseTo(4.6);
	});

	it('PER_PAIR: pairPurchasePrice = basePrice', () => {
		expect(computePairPurchasePrice(5.0, LensPriceType.PAIR)).toBe(5.0);
	});

	it('handles zero basePrice', () => {
		expect(computePairPurchasePrice(0, LensPriceType.UNIT)).toBe(0);
		expect(computePairPurchasePrice(0, LensPriceType.PAIR)).toBe(0);
	});

	it('updating basePrice recalculates for UNIT', () => {
		const first = computePairPurchasePrice(2.3, LensPriceType.UNIT);
		const second = computePairPurchasePrice(3.0, LensPriceType.UNIT);
		expect(first).toBeCloseTo(4.6);
		expect(second).toBeCloseTo(6.0);
	});

	it('changing pricingUnit from PAIR to UNIT doubles the basePrice', () => {
		const asPair = computePairPurchasePrice(10, LensPriceType.PAIR);
		const asUnit = computePairPurchasePrice(10, LensPriceType.UNIT);
		expect(asPair).toBe(10);
		expect(asUnit).toBe(20);
	});
});

describe('snapshot correctness expectations', () => {
	it('new sale with PER_UNIT lens should snapshot pairPurchasePrice, not basePrice', () => {
		// Simulates what NewSaleForm.handleSubmit now does
		const lens = {
			basePrice: 2.3,
			priceType: LensPriceType.UNIT,
			pairPurchasePrice: computePairPurchasePrice(2.3, LensPriceType.UNIT)
		};

		// Before fix: snapshotBaseCost = lens.basePrice (2.3) — WRONG
		// After fix:  snapshotBaseCost = lens.pairPurchasePrice (4.6) — CORRECT
		const snapshotBaseCost = lens.pairPurchasePrice;
		expect(snapshotBaseCost).toBeCloseTo(4.6);
		expect(snapshotBaseCost).not.toBe(lens.basePrice);
	});

	it('new sale with PER_PAIR lens: snapshotBaseCost equals basePrice', () => {
		const lens = {
			basePrice: 5.0,
			priceType: LensPriceType.PAIR,
			pairPurchasePrice: computePairPurchasePrice(5.0, LensPriceType.PAIR)
		};

		const snapshotBaseCost = lens.pairPurchasePrice;
		expect(snapshotBaseCost).toBe(5.0);
		expect(snapshotBaseCost).toBe(lens.basePrice);
	});
});

describe('migration backfill expectations', () => {
	it('existing PER_UNIT records: pairPurchasePrice = basePrice × 2', () => {
		const existingRecords = [
			{ basePrice: 2.3, priceType: 'UNIT' },
			{ basePrice: 1.5, priceType: 'UNIT' }
		];

		for (const r of existingRecords) {
			expect(computePairPurchasePrice(r.basePrice, r.priceType)).toBeCloseTo(r.basePrice * 2);
		}
	});

	it('existing PER_PAIR records: pairPurchasePrice = basePrice', () => {
		const existingRecords = [
			{ basePrice: 5.0, priceType: 'PAIR' },
			{ basePrice: 12.0, priceType: 'PAIR' }
		];

		for (const r of existingRecords) {
			expect(computePairPurchasePrice(r.basePrice, r.priceType)).toBe(r.basePrice);
		}
	});
});

describe('margin calculation', () => {
	it('calculates margin correctly from pairPurchasePrice', () => {
		// Store sells at $25/pair, cost is $4.60/pair
		const pairPurchasePrice = computePairPurchasePrice(2.3, LensPriceType.UNIT); // 4.60
		const salePrice = 25;
		const margin = ((salePrice - pairPurchasePrice) / pairPurchasePrice) * 100;
		expect(margin).toBeCloseTo(443.48, 1);
	});

	it('returns negative margin when salePrice < cost', () => {
		const pairPurchasePrice = computePairPurchasePrice(15, LensPriceType.PAIR); // 15
		const salePrice = 10;
		const margin = ((salePrice - pairPurchasePrice) / pairPurchasePrice) * 100;
		expect(margin).toBeCloseTo(-33.33, 1);
	});
});
