import { describe, expect, it } from 'vitest';
import { PurchaseDiscountType, PurchasePaymentTerms } from '$lib/shared/enums';
import {
	calculatePurchaseOrderDebtTotal,
	computePurchaseOrderBalance,
	getEarlyPaymentDiscountEarned,
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
	it('recognizes a single-installment pronto pago discount when the net amount is paid before deadline', () => {
		expect(
			getEarlyPaymentDiscountEarned(
				1000,
				[
					{
						installmentNumber: 1,
						dueDate: '2026-05-31',
						expectedAmountUsd: null,
						earlyPaymentDiscountPercent: 5,
						earlyPaymentDiscountDeadline: '2026-05-20'
					}
				],
				[
					{
						amountUsdBcv: 950,
						paymentDate: '2026-05-18',
						voidedAt: null
					}
				]
			)
		).toBe(50);
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
					installmentNumber: 1,
					dueDate: '2026-05-31',
					expectedAmountUsd: null,
					earlyPaymentDiscountPercent: 5,
					earlyPaymentDiscountDeadline: '2026-05-20'
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
				installments: [
					{
						installmentNumber: 1,
						dueDate: '2026-05-10',
						expectedAmountUsd: 100,
						earlyPaymentDiscountPercent: null,
						earlyPaymentDiscountDeadline: null
					}
				],
				balance: 40,
				referenceDate: '2026-05-13'
			})
		).toEqual({ kind: 'OVERDUE', date: '2026-05-10', daysUntil: -3 });
	});
});
