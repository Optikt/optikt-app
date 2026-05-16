import { describe, expect, it } from 'vitest';
import { PurchaseDiscountType, PurchasePaymentTerms } from '$lib/shared/enums';
import {
	calculatePurchaseOrderDebtTotal,
	computePurchaseOrderBalance,
	getEarlyPaymentDiscountEarned,
	getEarlyPaymentDiscountSuggestion,
	getPurchaseOrderDueStatus
} from './purchaseOrderCredit';

const baseItems = [
	{
		quantity: 10,
		unitPurchasePrice: 11.6,
		appliesIva: true,
		ivaRate: 16
	}
];

describe('calculatePurchaseOrderDebtTotal', () => {
	it('applies the existing settlement discount to the payable total', () => {
		expect(
			calculatePurchaseOrderDebtTotal(baseItems, {
				settlementDiscountType: PurchaseDiscountType.PERCENT,
				settlementDiscountValue: 5
			})
		).toBe(110.2);
	});
});

describe('getEarlyPaymentDiscountEarned', () => {
	it('sums applied, non-voided pronto pago benefits', () => {
		expect(
			getEarlyPaymentDiscountEarned([
				{ amountUsdBcv: 50, appliedToBalance: true, voidedAt: null },
				{ amountUsdBcv: 20, appliedToBalance: false, voidedAt: null },
				{ amountUsdBcv: 10, appliedToBalance: true, voidedAt: '2026-05-19' }
			])
		).toBe(50);
	});
});

describe('getEarlyPaymentDiscountSuggestion', () => {
	it('suggests the residual balance as a pronto pago benefit for an eligible payment', () => {
		expect(
			getEarlyPaymentDiscountSuggestion({
				terms: {
					paymentTerms: PurchasePaymentTerms.CREDIT,
					earlyPaymentDiscountPercent: 5,
					earlyPaymentDiscountDeadline: '2026-05-20'
				},
				totalDebt: 1000,
				currentBalance: 1000,
				paymentAmountUsdBcv: 950,
				paymentDate: '2026-05-18'
			})
		).toMatchObject({
			amountUsdBcv: 50,
			residualAfterPayment: 50,
			recommendedPaymentUsdBcv: 950,
			overpaymentUsdBcv: 0,
			percent: 5
		});
	});

	it('still suggests pronto pago when the entered payment covers the full balance', () => {
		expect(
			getEarlyPaymentDiscountSuggestion({
				terms: {
					paymentTerms: PurchasePaymentTerms.CREDIT,
					earlyPaymentDiscountPercent: 5,
					earlyPaymentDiscountDeadline: '2026-05-20'
				},
				totalDebt: 1000,
				currentBalance: 400,
				paymentAmountUsdBcv: 400,
				paymentDate: '2026-05-18'
			})
		).toMatchObject({
			amountUsdBcv: 50,
			residualAfterPayment: 0,
			recommendedPaymentUsdBcv: 350,
			overpaymentUsdBcv: 50,
			percent: 5
		});
	});
});

describe('computePurchaseOrderBalance', () => {
	it('closes the balance with the recognized early payment discount', () => {
		const balance = computePurchaseOrderBalance(
			{
				settlementDiscountType: PurchaseDiscountType.NONE,
				settlementDiscountValue: 0
			},
			[
				{
					quantity: 1,
					unitPurchasePrice: 1000,
					appliesIva: false,
					ivaRate: 0
				}
			],
			[
				{
					amountUsdBcv: 950,
					paymentDate: '2026-05-18',
					voidedAt: null
				}
			],
			[
				{
					amountUsdBcv: 50,
					appliedToBalance: true,
					voidedAt: null
				}
			]
		);

		expect(balance.earlyPaymentDiscountEarned).toBe(50);
		expect(balance.balance).toBe(0);
		expect(balance.isFullyPaid).toBe(true);
	});
});

describe('getPurchaseOrderDueStatus', () => {
	it('marks a credit order as overdue when there is pending balance and the due date passed', () => {
		expect(
			getPurchaseOrderDueStatus({
				paymentTerms: PurchasePaymentTerms.CREDIT,
				creditDueDate: '2026-05-10',
				earlyPaymentDiscountDeadline: null,
				balance: 40,
				referenceDate: '2026-05-13'
			})
		).toEqual({ kind: 'OVERDUE', date: '2026-05-10', daysUntil: -3 });
	});
});
