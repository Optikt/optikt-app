import { describe, expect, it } from 'vitest';
import { PurchaseDiscountType, PurchaseSourceCurrency } from '$lib/shared/enums';
import {
	buildPurchaseDetailSummary,
	buildRevertTarget,
	buildSettlementDiscount,
	buildUnmarkReadyMessage,
	toggleItemReviewedLocal
} from './purchaseDetail';

describe('buildSettlementDiscount', () => {
	it('defaults to NONE and zero', () => {
		expect(buildSettlementDiscount({})).toEqual({ type: PurchaseDiscountType.NONE, value: 0 });
		expect(
			buildSettlementDiscount({ settlementDiscountType: 'PERCENT', settlementDiscountValue: 10 })
		).toEqual({ type: 'PERCENT', value: 10 });
	});
});

describe('buildPurchaseDetailSummary', () => {
	const order = {
		bcvRate: 200,
		sourceCurrency: PurchaseSourceCurrency.USD,
		settlementDiscountType: null,
		settlementDiscountValue: null
	} as unknown as Parameters<typeof buildPurchaseDetailSummary>[0];

	it('aggregates totals and labels', () => {
		const summary = buildPurchaseDetailSummary(order, []);

		expect(summary.totalUnits).toBe(0);
		expect(summary.hasSettlementDiscount).toBe(false);
		expect(summary.settlementDiscountLabel).toBe('Sin descuento');
	});

	it('labels percent and amount discounts', () => {
		const percent = buildPurchaseDetailSummary(
			{ ...order, settlementDiscountType: 'PERCENT', settlementDiscountValue: 5 },
			[]
		);
		expect(percent.settlementDiscountLabel).toBe('5%');
		expect(percent.hasSettlementDiscount).toBe(true);

		const amount = buildPurchaseDetailSummary(
			{ ...order, settlementDiscountType: 'AMOUNT', settlementDiscountValue: 10 },
			[]
		);
		expect(amount.settlementDiscountLabel).toContain('10');
	});
});

describe('buildUnmarkReadyMessage', () => {
	it('counts lost checks', () => {
		expect(buildUnmarkReadyMessage(0)).toContain('volverá a preparación');
		expect(buildUnmarkReadyMessage(1)).toContain('1 check');
		expect(buildUnmarkReadyMessage(3)).toContain('3 checks');
	});
});

describe('buildRevertTarget', () => {
	const lots = { 'lot-1': { quantityInitial: 5 } } as never;

	it('resolves lot targets', () => {
		const target = buildRevertTarget({ lotId: 'lot-1', productId: 'p-1' } as never, lots);

		expect(target).toMatchObject({ lotId: 'lot-1', quantity: 5 });
		expect(buildRevertTarget({ lotId: null } as never, lots)).toBeNull();
		expect(buildRevertTarget({ lotId: 'missing' } as never, lots)).toBeNull();
	});
});

describe('toggleItemReviewedLocal', () => {
	it('flips one row immutably', () => {
		const rows = [
			{ id: 'a', isReviewed: false },
			{ id: 'b', isReviewed: true }
		];
		const next = toggleItemReviewedLocal(rows, 'a', true);

		expect(next[0].isReviewed).toBe(true);
		expect(rows[0].isReviewed).toBe(false);
		expect(next[1]).toBe(rows[1]);
	});
});
