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
	rates: Partial<Pick<PaymentFormValueInputs, 'storeBcvRate'>> = {}
): PaymentFormValueInputs {
	return {
		props: { kind: 'sale', ...props } as PaymentFormProps,
		selection: { ...emptySelection, ...selection },
		storeBcvRate: rates.storeBcvRate ?? 0,
		eurRate: 0,
		usdtRate: 0,
		paypalRate: 0
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
});
