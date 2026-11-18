import { describe, expect, it } from 'vitest';

import {
	computeLensSnapshotCostTotal,
	computeSnapshotCostUnit,
	resolveLensSnapshotCosts
} from './saleItemCosts';
import { SaleItemType } from './enums/lensTypes';

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

describe('resolveLensSnapshotCosts (fuente única ventas/quotes)', () => {
	it('solo calcula costos para LENS_PAIR', () => {
		expect(
			resolveLensSnapshotCosts({
				itemType: SaleItemType.PRODUCT,
				quantity: 2,
				snapshotBaseCost: 100
			})
		).toEqual({ snapshotCostTotal: null, snapshotCostUnit: null });
	});

	it('total = base + montaje + envío y unitario sin redondear', () => {
		expect(
			resolveLensSnapshotCosts({
				itemType: SaleItemType.LENS_PAIR,
				quantity: 3,
				snapshotBaseCost: 100,
				snapshotMountingPrice: 20,
				snapshotShippingPrice: 10
			})
		).toEqual({ snapshotCostTotal: 130, snapshotCostUnit: 130 / 3 });
	});

	it('shippingCostPending excluye el envío', () => {
		expect(
			resolveLensSnapshotCosts({
				itemType: SaleItemType.LENS_PAIR,
				quantity: 1,
				snapshotBaseCost: 100,
				snapshotShippingPrice: 10,
				shippingCostPending: true
			}).snapshotCostTotal
		).toBe(100);
	});
});
