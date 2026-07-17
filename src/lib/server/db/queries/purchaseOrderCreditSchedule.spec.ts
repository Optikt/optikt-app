import { describe, it, expect } from 'vitest';
import { computePurchaseOrderBalance } from '$lib/shared/purchaseOrderCredit';

describe('getUpcomingPurchaseOrderDues settlement contract', () => {
	it('computePurchaseOrderBalance returns native fields when settlement is provided', () => {
		const balance = computePurchaseOrderBalance(
			{ settlementDiscountType: 'NONE', settlementDiscountValue: 0 },
			[{ quantity: 5, unitPurchasePrice: 50, appliesIva: false, ivaRate: 0 }],
			[{ amountUsdBcv: 100, paymentDate: '2026-06-01', voidedAt: null, amountAppliedToDebt: 90 }],
			[],
			{ settlementCurrency: 'USDT', settlementGrossAmount: 250, settlementDebtAmount: 250 }
		);

		expect(balance.settlementCurrency).toBe('USDT');
		expect(balance.settlementGrossAmount).toBe(250);
		expect(balance.settlementDebtAmount).toBe(250);
		expect(balance.totalAppliedToDebt).toBe(90);
		expect(balance.settlementBalance).toBe(160);
	});

	it('sets isSettlementFullyPaid when settlement balance is zero', () => {
		const balance = computePurchaseOrderBalance(
			{ settlementDiscountType: 'NONE', settlementDiscountValue: 0 },
			[{ quantity: 2, unitPurchasePrice: 100, appliesIva: false, ivaRate: 0 }],
			[{ amountUsdBcv: 200, paymentDate: '2026-06-01', voidedAt: null, amountAppliedToDebt: 200 }],
			[],
			{ settlementCurrency: 'USD_BCV', settlementGrossAmount: 200, settlementDebtAmount: 200 }
		);

		expect(balance.settlementBalance).toBe(0);
		expect(balance.isSettlementFullyPaid).toBe(true);
	});

	it('computes exchange variance from payment snapshots', () => {
		const balance = computePurchaseOrderBalance(
			{ settlementDiscountType: 'NONE', settlementDiscountValue: 0 },
			[{ quantity: 1, unitPurchasePrice: 200, appliesIva: false, ivaRate: 0 }],
			[
				{
					amountUsdBcv: 105,
					amountAppliedToDebt: 100,
					amountAppliedToDebtUsdBcvAtOrder: 125,
					paymentDate: '2026-06-01',
					voidedAt: null
				}
			],
			[],
			{
				settlementCurrency: 'USDT',
				settlementDebtAmount: 200,
				settlementDebtAmountUsdBcvAtOrder: 250
			}
		);

		// Only the payment contributes variance: 125 - 105 = 20 (gain)
		expect(balance.totalExchangeVariance).toBe(20);
	});
});
