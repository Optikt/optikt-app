import { describe, expect, it } from 'vitest';
import {
	calculatePaymentAmountFromUsdBcv,
	calculateUsdBcvFromPaymentAmount,
	getDefaultPaymentCalculationMode
} from './paymentFormCalculations';
import { PaymentMethod } from '$lib/shared/enums';

describe('getDefaultPaymentCalculationMode', () => {
	it('defaults bolivar methods to target mode', () => {
		expect(getDefaultPaymentCalculationMode(PaymentMethod.PAGO_MOVIL_BS)).toBe('target');
		expect(getDefaultPaymentCalculationMode(PaymentMethod.EFECTIVO_BS)).toBe('target');
	});

	it('defaults foreign-currency methods to native mode', () => {
		expect(getDefaultPaymentCalculationMode(PaymentMethod.EFECTIVO_USD)).toBe('native');
		expect(getDefaultPaymentCalculationMode(PaymentMethod.BINANCE_USDT)).toBe('native');
	});
});

describe('calculatePaymentAmountFromUsdBcv', () => {
	it('converts USD BCV target to bolivares for Bs methods', () => {
		expect(
			calculatePaymentAmountFromUsdBcv({
				method: PaymentMethod.PAGO_MOVIL_BS,
				usdBcvAmount: 50,
				bcvRate: 36.5
			})
		).toBe(1825);
	});

	it('converts USD BCV target to cash USD with exchange rate', () => {
		expect(
			calculatePaymentAmountFromUsdBcv({
				method: PaymentMethod.EFECTIVO_USD,
				usdBcvAmount: 50,
				bcvRate: 36.5,
				exchangeRate: 40
			})
		).toBe(45.63);
	});

	it('returns 0 when a foreign-currency method has no exchange rate', () => {
		expect(
			calculatePaymentAmountFromUsdBcv({
				method: PaymentMethod.BINANCE_USDT,
				usdBcvAmount: 50,
				bcvRate: 36.5
			})
		).toBe(0);
	});
});

describe('calculateUsdBcvFromPaymentAmount', () => {
	it('converts bolivares back to USD BCV for Bs methods', () => {
		expect(
			calculateUsdBcvFromPaymentAmount({
				method: PaymentMethod.PAGO_MOVIL_BS,
				paymentAmount: 1825,
				bcvRate: 36.5
			})
		).toBe(50);
	});

	it('converts cash USD received into USD BCV equivalent', () => {
		expect(
			calculateUsdBcvFromPaymentAmount({
				method: PaymentMethod.EFECTIVO_USD,
				paymentAmount: 20,
				bcvRate: 36.5,
				exchangeRate: 40
			})
		).toBe(21.92);
	});

	it('converts Binance USDT received into USD BCV equivalent', () => {
		expect(
			calculateUsdBcvFromPaymentAmount({
				method: PaymentMethod.BINANCE_USDT,
				paymentAmount: 20,
				bcvRate: 36.5,
				exchangeRate: 39.8
			})
		).toBe(21.81);
	});
});
