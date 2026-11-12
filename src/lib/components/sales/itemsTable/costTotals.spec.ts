import { describe, expect, it } from 'vitest';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
import { FreeItemEnrichmentStatus, SaleItemType } from '$lib/shared/enums/lensTypes';
import type { DisplayGroup } from './itemDisplay';
import { checkHasAnyCost, computeGrossMargin, computeInternalCostTotal } from './costTotals';

function item(overrides: Record<string, unknown>): SaleItemWithDetails {
	return {
		itemType: SaleItemType.PRODUCT,
		quantity: 1,
		...overrides
	} as unknown as SaleItemWithDetails;
}

function group(item: SaleItemWithDetails, quantity = 1): DisplayGroup {
	return { key: 'g1', item, quantity, discountAmount: 0, lineTotal: 10, treatments: [] };
}

describe('computeInternalCostTotal', () => {
	it('returns 0 for an empty list', () => {
		expect(computeInternalCostTotal([])).toBe(0);
	});

	it('uses snapshotCostTotal when present (persisted line cost)', () => {
		const groups = [group(item({ snapshotCostTotal: 12.5, snapshotCostUnit: 99 }))];
		expect(computeInternalCostTotal(groups)).toBe(12.5);
	});

	it('sums base + mounting + shipping for lens pairs without a line cost', () => {
		const lens = item({
			itemType: SaleItemType.LENS_PAIR,
			snapshotBaseCost: 10,
			snapshotMountingPrice: 4,
			snapshotShippingPrice: 2
		});
		expect(computeInternalCostTotal([group(lens)])).toBe(16);
	});

	it('ignores pending shipping for lens pairs', () => {
		const lens = item({
			itemType: SaleItemType.LENS_PAIR,
			snapshotBaseCost: 10,
			snapshotMountingPrice: 4,
			snapshotShippingPrice: 2,
			shippingCostPending: true
		});
		expect(computeInternalCostTotal([group(lens)])).toBe(14);
	});

	it('multiplies unit cost by quantity as a fallback', () => {
		expect(computeInternalCostTotal([group(item({ snapshotCostUnit: 3 }), 4)])).toBe(12);
	});

	it('counts enriched free items by unit cost and skips pending ones', () => {
		const enriched = item({
			itemType: SaleItemType.FREE_ITEM,
			freeDetails: { enrichmentStatus: FreeItemEnrichmentStatus.ENRICHED, unitCost: 2.5 } as never
		});
		const pending = item({
			itemType: SaleItemType.FREE_ITEM,
			freeDetails: { enrichmentStatus: FreeItemEnrichmentStatus.PENDING, unitCost: 9 } as never
		});
		expect(computeInternalCostTotal([group(enriched, 2), group(pending, 1)])).toBe(5);
	});
});

describe('checkHasAnyCost', () => {
	it('is false when no cost field is set', () => {
		expect(checkHasAnyCost([group(item({}))])).toBe(false);
		expect(
			checkHasAnyCost([
				group(
					item({
						itemType: SaleItemType.FREE_ITEM,
						freeDetails: { enrichmentStatus: FreeItemEnrichmentStatus.PENDING } as never
					})
				)
			])
		).toBe(false);
	});

	it('is true for any persisted cost field or an enriched free item', () => {
		expect(checkHasAnyCost([group(item({ snapshotCostTotal: 1 }))])).toBe(true);
		expect(checkHasAnyCost([group(item({ snapshotBaseCost: 1 }))])).toBe(true);
		expect(checkHasAnyCost([group(item({ snapshotMountingPrice: 1 }))])).toBe(true);
		expect(checkHasAnyCost([group(item({ snapshotShippingPrice: 1 }))])).toBe(true);
		expect(checkHasAnyCost([group(item({ snapshotCostUnit: 1 }))])).toBe(true);
		expect(
			checkHasAnyCost([
				group(
					item({
						itemType: SaleItemType.FREE_ITEM,
						freeDetails: { enrichmentStatus: FreeItemEnrichmentStatus.ENRICHED } as never
					})
				)
			])
		).toBe(true);
	});
});

describe('computeGrossMargin', () => {
	it('computes amount and percent over the net subtotal', () => {
		expect(computeGrossMargin(200, 120)).toEqual({ amount: 80, percent: 40 });
	});

	it('returns a null percent when the net subtotal is zero', () => {
		expect(computeGrossMargin(0, 30)).toEqual({ amount: -30, percent: null });
	});
});
