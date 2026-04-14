import { describe, expect, it } from 'vitest';

import { computeLensSnapshotCostTotal, computeSnapshotCostUnit } from './saleItemCosts';

describe('computeLensSnapshotCostTotal', () => {
	it('adds base, mounting and shipping when shipping is not pending', () => {
		expect(
			computeLensSnapshotCostTotal({
				snapshotBaseCost: 4.6,
				snapshotMountingPrice: 3,
				snapshotShippingPrice: 2.5,
				shippingCostPending: false
			})
		).toBeCloseTo(10.1);
	});

	it('excludes shipping when shipping is pending', () => {
		expect(
			computeLensSnapshotCostTotal({
				snapshotBaseCost: 4.6,
				snapshotMountingPrice: 3,
				snapshotShippingPrice: 25,
				shippingCostPending: true
			})
		).toBeCloseTo(7.6);
	});
});

describe('computeSnapshotCostUnit', () => {
	it('returns total divided by quantity when quantity is positive', () => {
		expect(computeSnapshotCostUnit(12, 3)).toBe(4);
	});

	it('returns null for invalid quantities', () => {
		expect(computeSnapshotCostUnit(12, 0)).toBeNull();
	});
});
