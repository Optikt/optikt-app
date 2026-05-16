import { describe, expect, it } from 'vitest';
import { CurrencyCode } from '$lib/shared/enums';
import {
	denormalizePurchasePaymentAmount,
	getPurchasePaymentSpecificRateLabel,
	normalizePurchasePaymentAmounts,
	requiresPurchasePaymentSpecificRate
} from './purchaseOrderPayments';

describe('requiresPurchasePaymentSpecificRate', () => {
	it('does not require a specific rate for USD BCV', () => {
		expect(requiresPurchasePaymentSpecificRate(CurrencyCode.USD_BCV)).toBe(false);
	});

	it('does not require a specific rate for VES', () => {
		expect(requiresPurchasePaymentSpecificRate(CurrencyCode.VES)).toBe(false);
	});

	it('requires a specific rate for non-BCV currencies', () => {
		expect(requiresPurchasePaymentSpecificRate(CurrencyCode.USDT)).toBe(true);
		expect(requiresPurchasePaymentSpecificRate(CurrencyCode.OTHER)).toBe(true);
	});
});

describe('getPurchasePaymentSpecificRateLabel', () => {
	it('returns a descriptive label for each non-base currency', () => {
		expect(getPurchasePaymentSpecificRateLabel(CurrencyCode.USDT)).toContain('USDT');
		expect(getPurchasePaymentSpecificRateLabel(CurrencyCode.OTHER)).toContain('Tasa usada');
	});
});

describe('normalizePurchasePaymentAmounts', () => {
	it('normalizes USD BCV payments directly', () => {
		expect(
			normalizePurchasePaymentAmounts({
				currencyCode: CurrencyCode.USD_BCV,
				amount: 50,
				bcvUsdRate: 100
			})
		).toEqual({ amountBs: 5000, amountUsdBcv: 50 });
	});

	it('normalizes USDT payments using their own operative rate and BCV reference', () => {
		expect(
			normalizePurchasePaymentAmounts({
				currencyCode: CurrencyCode.USDT,
				amount: 20,
				bcvUsdRate: 90,
				specificRate: 95
			})
		).toEqual({ amountBs: 1900, amountUsdBcv: 21.11 });
	});

	it('returns zeroed amounts when the operative rate is missing for non-base currencies', () => {
		expect(
			normalizePurchasePaymentAmounts({
				currencyCode: CurrencyCode.OTHER,
				amount: 20,
				bcvUsdRate: 90
			})
		).toEqual({ amountBs: 0, amountUsdBcv: 0 });
	});

	it('normalizes VES payments: amount is Bs, divides by BCV rate to get USD', () => {
		expect(
			normalizePurchasePaymentAmounts({
				currencyCode: CurrencyCode.VES,
				amount: 11928.5,
				bcvUsdRate: 477.14
			})
		).toEqual({ amountBs: 11928.5, amountUsdBcv: 25.0 });
	});

	it('normalizes VES payments with rounding: 6950 Bs at 477.14', () => {
		expect(
			normalizePurchasePaymentAmounts({
				currencyCode: CurrencyCode.VES,
				amount: 6950,
				bcvUsdRate: 477.14
			})
		).toEqual({ amountBs: 6950, amountUsdBcv: 14.57 });
	});

	it('returns zeroed amounts for VES when BCV rate is zero', () => {
		expect(
			normalizePurchasePaymentAmounts({
				currencyCode: CurrencyCode.VES,
				amount: 5000,
				bcvUsdRate: 0
			})
		).toEqual({ amountBs: 0, amountUsdBcv: 0 });
	});
});

describe('denormalizePurchasePaymentAmount', () => {
	it('reconstructs a USD BCV payment amount directly', () => {
		expect(
			denormalizePurchasePaymentAmount({
				currencyCode: CurrencyCode.USD_BCV,
				amountUsdBcv: 350,
				bcvUsdRate: 40
			})
		).toBe(350);
	});

	it('reconstructs a VES payment amount from USD BCV', () => {
		expect(
			denormalizePurchasePaymentAmount({
				currencyCode: CurrencyCode.VES,
				amountUsdBcv: 350,
				bcvUsdRate: 40
			})
		).toBe(14000);
	});

	it('reconstructs a non-base currency payment amount from USD BCV and operative rate', () => {
		expect(
			denormalizePurchasePaymentAmount({
				currencyCode: CurrencyCode.USDT,
				amountUsdBcv: 350,
				bcvUsdRate: 40,
				specificRate: 44
			})
		).toBe(318.18);
	});
});
