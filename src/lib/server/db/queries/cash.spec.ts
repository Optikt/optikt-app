import { describe, it, expect } from 'vitest';
import { computePaymentExchangeVariance } from '$lib/shared/purchaseOrderPayments';

describe('exchange settlement variance', () => {
	it('computes variance for a single payment', () => {
		expect(
			computePaymentExchangeVariance(100, 250, 320, 125)
		).toBe(3);
	});

	it('returns 0 when settlementDebtAmount is 0', () => {
		expect(
			computePaymentExchangeVariance(100, 0, 320, 125)
		).toBe(0);
	});

	it('returns 0 when amountAppliedToDebt is 0', () => {
		expect(
			computePaymentExchangeVariance(0, 250, 320, 125)
		).toBe(0);
	});
});
