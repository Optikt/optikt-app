import { describe, expect, it } from 'vitest';
import { PaymentMethod } from '$lib/shared/enums';
import {
	computePaymentFormValues,
	type PaymentFormSelectionValues,
	type PaymentFormValueInputs
} from './paymentFormValues';
import type { PaymentFormProps } from './paymentFormDerived';

const emptySelection: PaymentFormSelectionValues = {
	currencyKey: null,
	rail: null,
	lastEditedAmount: 'native',
	nativeAmountInput: '',
	usdBcvAmountInput: '',
	bcvRateInput: '',
	specificRateInput: '',
	paymentDate: '2026-01-15',
	reference: ''
};

function inputs(
	props: Partial<PaymentFormProps>,
	selection: Partial<PaymentFormSelectionValues> = {},
	rates: Partial<
		Pick<PaymentFormValueInputs, 'storeBcvRate' | 'eurRate' | 'usdtRate' | 'paypalRate'>
	> = {}
): PaymentFormValueInputs {
	return {
		props: { kind: 'sale', ...props } as PaymentFormProps,
		selection: { ...emptySelection, ...selection },
		storeBcvRate: rates.storeBcvRate ?? 0,
		eurRate: rates.eurRate ?? 0,
		usdtRate: rates.usdtRate ?? 0,
		paypalRate: rates.paypalRate ?? 0
	};
}

describe('computePaymentFormValues · sale', () => {
	it('derives the debt balance from remainingBcvUsd and marks pending after payment', () => {
		const values = computePaymentFormValues(inputs({ kind: 'sale', remainingBcvUsd: 100 }));

		expect(values.debtBalanceUsd).toBe(100);
		expect(values.pendingAfterPayment).toBe(100);
		expect(values.overpaymentAmount).toBe(0);
		expect(values.restLabelClass).toBe('text-warning');
	});

	it('converts a Bs amount to USD BCV with the active rate', () => {
		const values = computePaymentFormValues(
			inputs(
				{ kind: 'sale', remainingBcvUsd: 100 },
				{
					currencyKey: 'VES',
					rail: PaymentMethod.EFECTIVO_BS,
					nativeAmountInput: '4000',
					bcvRateInput: '40'
				}
			)
		);

		expect(values.activeBcvRate).toBe(40);
		expect(values.resolvedAmountUsd).toBe(100);
		expect(values.resolvedNativeAmount).toBe(4000);
		expect(values.pendingAfterPayment).toBe(0);
	});

	it('fills the native field from the USD field when the user edits USD', () => {
		const values = computePaymentFormValues(
			inputs(
				{ kind: 'sale', remainingBcvUsd: 100 },
				{
					currencyKey: 'VES',
					rail: PaymentMethod.EFECTIVO_BS,
					lastEditedAmount: 'usd',
					usdBcvAmountInput: '25',
					bcvRateInput: '40'
				}
			)
		);

		expect(values.usdFieldValue).toBe('25');
		expect(values.nativeFieldValue).toBe('1000.00');
		expect(values.overpaymentAmount).toBe(0);
	});

	it('flags overpayment when the amount exceeds the balance', () => {
		const values = computePaymentFormValues(
			inputs(
				{ kind: 'sale', remainingBcvUsd: 50 },
				{
					currencyKey: 'VES',
					rail: PaymentMethod.EFECTIVO_BS,
					lastEditedAmount: 'usd',
					usdBcvAmountInput: '80',
					bcvRateInput: '40'
				}
			)
		);

		expect(values.overpaymentAmount).toBe(30);
		expect(values.restLabelClass).toBe('text-error');
	});

	it('requires a reference when the rail demands it', () => {
		const base = {
			currencyKey: 'VES',
			rail: PaymentMethod.TRANSFERENCIA_BS,
			lastEditedAmount: 'usd' as const,
			usdBcvAmountInput: '40',
			bcvRateInput: '40'
		};

		const missing = computePaymentFormValues(inputs({ kind: 'sale', remainingBcvUsd: 50 }, base));
		expect(missing.referenceConfig.label).toBe('Número de transacción');
		expect(missing.hasRequiredReference).toBe(false);

		const filled = computePaymentFormValues(
			inputs({ kind: 'sale', remainingBcvUsd: 50 }, { ...base, reference: 'ABC-123' })
		);
		expect(filled.hasRequiredReference).toBe(true);
		expect(filled.referenceToSubmit).toBe('ABC-123');
	});

	it('falls back to the store BCV rate for sales', () => {
		const values = computePaymentFormValues(
			inputs({ kind: 'sale', bcvRate: 0 }, {}, { storeBcvRate: 38.5 })
		);

		expect(values.effectiveBcvRate).toBe(38.5);
		expect(values.defaultBcvRateInput).toBe('38.50');
	});
});

describe('computePaymentFormValues · purchase', () => {
	it('uses the order rate and derives the native settlement context', () => {
		const values = computePaymentFormValues(
			inputs(
				{
					kind: 'purchase',
					status: 'CONFIRMED',
					defaultBcvRate: 40,
					pendingBalanceUsd: 400,
					debtTotalUsd: 1000,
					settlementCurrency: 'USD_BCV'
				},
				{
					currencyKey: 'VES',
					rail: PaymentMethod.TRANSFERENCIA_BS,
					lastEditedAmount: 'usd',
					usdBcvAmountInput: '300',
					reference: 'REF-1'
				}
			)
		);

		expect(values.effectiveBcvRate).toBe(40);
		expect(values.canManagePurchasePayments).toBe(true);
		expect(values.isNativeSettlement).toBe(false);
		expect(values.resolvedNativeAmount).toBe(12000);
		expect(values.pendingAfterPayment).toBe(100);
		expect(values.rateContextLine).toContain('×');
	});

	it('denormalizes the native amount for a native settlement currency', () => {
		const values = computePaymentFormValues(
			inputs({
				kind: 'purchase',
				status: 'CONFIRMED',
				defaultBcvRate: 40,
				pendingBalanceUsd: 400,
				debtTotalUsd: 1000,
				settlementCurrency: 'EUR_BCV'
			})
		);

		expect(values.isNativeSettlement).toBe(true);
		expect(values.settlementSymbol).toBe('€');
		expect(values.needsSpecificRate).toBe(false);
	});

	it('applies a EUR delivery to the debt one-to-one', () => {
		const values = computePaymentFormValues(
			inputs(
				{
					kind: 'purchase',
					status: 'CONFIRMED',
					defaultBcvRate: 200,
					pendingBalanceUsd: 13.5,
					debtTotalUsd: 13.5,
					settlementCurrency: 'EUR_BCV',
					purchaseOrder: { settlementDebtAmount: 13.5 } as never
				},
				{
					currencyKey: 'EUR_BCV',
					rail: PaymentMethod.EFECTIVO_EUR,
					lastEditedAmount: 'native',
					nativeAmountInput: '13.50',
					bcvRateInput: '200',
					specificRateInput: '978.17'
				}
			)
		);

		expect(values.amountAppliedToDebt).toBe(13.5);
		expect(values.pendingAfterPayment).toBe(0);
		expect(values.overpaymentAmount).toBe(0);
	});

	it('converts a Bs delivery into the EUR debt using the settlement rate', () => {
		const values = computePaymentFormValues(
			inputs(
				{
					kind: 'purchase',
					status: 'CONFIRMED',
					defaultBcvRate: 200,
					pendingBalanceUsd: 13.5,
					debtTotalUsd: 13.5,
					settlementCurrency: 'EUR_BCV',
					purchaseOrder: { settlementDebtAmount: 13.5 } as never
				},
				{
					currencyKey: 'VES',
					rail: PaymentMethod.TRANSFERENCIA_BS,
					lastEditedAmount: 'native',
					nativeAmountInput: '13205.30',
					bcvRateInput: '200',
					specificRateInput: '978.17'
				}
			)
		);

		expect(values.needsSpecificRate).toBe(true);
		expect(values.specificRateLabel).toBe('Tasa EUR (Bs/€)');
		expect(values.amountAppliedToDebt).toBe(13.5);
		expect(values.pendingAfterPayment).toBe(0);
	});

	it('converts a USD delivery into the EUR debt through Bs', () => {
		const values = computePaymentFormValues(
			inputs(
				{
					kind: 'purchase',
					status: 'CONFIRMED',
					defaultBcvRate: 200,
					pendingBalanceUsd: 13.5,
					debtTotalUsd: 13.5,
					settlementCurrency: 'EUR_BCV',
					purchaseOrder: { settlementDebtAmount: 13.5 } as never
				},
				{
					currencyKey: 'USD_BCV',
					rail: PaymentMethod.EFECTIVO_USD,
					lastEditedAmount: 'native',
					nativeAmountInput: '66.03',
					bcvRateInput: '200'
				},
				{ eurRate: 978.17 }
			)
		);

		expect(values.amountAppliedToDebt).toBe(13.5);
		expect(values.pendingAfterPayment).toBe(0);
	});

	it('exposes pronto pago terms within the window even before typing an amount', () => {
		const values = computePaymentFormValues(
			inputs(
				{
					kind: 'purchase',
					status: 'CONFIRMED',
					defaultBcvRate: 40,
					pendingBalanceUsd: 345,
					debtTotalUsd: 345,
					settlementCurrency: 'USD_BCV',
					purchaseOrder: {
						paymentTerms: 'CREDIT',
						earlyPaymentDiscountPercent: 5,
						earlyPaymentDiscountDeadline: '2026-10-11'
					} as never
				},
				{ paymentDate: '2026-10-09' }
			)
		);

		expect(values.prontoPagoInfo).toMatchObject({
			percent: 5,
			discountAmount: 17.25,
			recommendedPayment: 327.75,
			withinWindow: true
		});
	});

	it('flags a payment date outside the pronto pago window', () => {
		const values = computePaymentFormValues(
			inputs(
				{
					kind: 'purchase',
					status: 'CONFIRMED',
					defaultBcvRate: 40,
					pendingBalanceUsd: 345,
					debtTotalUsd: 345,
					settlementCurrency: 'USD_BCV',
					purchaseOrder: {
						paymentTerms: 'CREDIT',
						earlyPaymentDiscountPercent: 5,
						earlyPaymentDiscountDeadline: '2026-10-11'
					} as never
				},
				{ paymentDate: '2026-10-15' }
			)
		);

		expect(values.prontoPagoInfo?.withinWindow).toBe(false);
	});

	it('hides the pronto pago notice once a benefit is applied', () => {
		const values = computePaymentFormValues(
			inputs({
				kind: 'purchase',
				status: 'CONFIRMED',
				defaultBcvRate: 40,
				pendingBalanceUsd: 327.75,
				debtTotalUsd: 345,
				settlementCurrency: 'USD_BCV',
				earlyPaymentBenefits: [{ voidedAt: null } as never],
				purchaseOrder: {
					paymentTerms: 'CREDIT',
					earlyPaymentDiscountPercent: 5,
					earlyPaymentDiscountDeadline: '2026-10-11'
				} as never
			})
		);

		expect(values.prontoPagoInfo).toBeNull();
	});

	it('flags native overpayment in the settlement currency', () => {
		const values = computePaymentFormValues(
			inputs(
				{
					kind: 'purchase',
					status: 'CONFIRMED',
					defaultBcvRate: 200,
					pendingBalanceUsd: 10,
					debtTotalUsd: 13.5,
					settlementCurrency: 'EUR_BCV',
					purchaseOrder: { settlementDebtAmount: 13.5 } as never
				},
				{
					currencyKey: 'EUR_BCV',
					rail: PaymentMethod.EFECTIVO_EUR,
					lastEditedAmount: 'native',
					nativeAmountInput: '13.50',
					bcvRateInput: '200',
					specificRateInput: '978.17'
				}
			)
		);

		expect(values.overpaymentAmount).toBe(3.5);
		expect(values.appliedDisplay).toBe('13.50 €');
		expect(values.pendingDisplay).toBe('10.00 €');
	});
});
