import { describe, it, expect } from 'vitest';
import {
	computePaymentExchangeVariance,
	computeTotalExchangeVariance
} from '$lib/shared/purchaseOrderPayments';

describe('computePaymentExchangeVariance', () => {
	it('returns 0 when settlementDebtAmount is 0 (legacy guard)', () => {
		expect(computePaymentExchangeVariance(100, 0, 100, 90)).toBe(0);
	});

	it('returns positive variance when BCV original > actual paid', () => {
		const variance = computePaymentExchangeVariance(50, 250, 320, 62);
		expect(variance).toBe(2);
	});

	it('returns negative variance when actual paid > BCV original', () => {
		const variance = computePaymentExchangeVariance(50, 250, 320, 68);
		expect(variance).toBe(-4);
	});

	it('prorates the original BCV value proportionally', () => {
		const variance = computePaymentExchangeVariance(100, 250, 320, 125);
		// 100/250 * 320 = 128, 128 - 125 = 3
		expect(variance).toBe(3);
	});
});

describe('computeTotalExchangeVariance', () => {
	it('aggregates across active payments, skipping voided ones', () => {
		const result = computeTotalExchangeVariance({
			settlementDebtAmount: 250,
			settlementDebtAmountUsdBcvAtOrder: 320,
			payments: [
				{ amountAppliedToDebt: 100, amountUsdBcv: 125, voidedAt: null },
				{ amountAppliedToDebt: 150, amountUsdBcv: 195, voidedAt: '2026-07-01' },
				{ amountAppliedToDebt: 50, amountUsdBcv: 62, voidedAt: null }
			]
		});
		expect(result).toBe(5); // (100/250*320 - 125) + (50/250*320 - 62) = (128-125) + (64-62) = 3+2
	});

	it('returns 0 for empty payments', () => {
		expect(
			computeTotalExchangeVariance({
				settlementDebtAmount: 100,
				settlementDebtAmountUsdBcvAtOrder: 100,
				payments: []
			})
		).toBe(0);
	});
});
