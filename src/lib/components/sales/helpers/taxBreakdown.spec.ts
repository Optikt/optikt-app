import { describe, expect, it } from 'vitest';

import { DiscountType } from '$lib/shared/enums';

import { computeSnapshotTaxBreakdown, getSnapshotTaxLabel } from './taxBreakdown';

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
