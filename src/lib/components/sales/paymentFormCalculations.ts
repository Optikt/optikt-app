import { isBsPaymentMethod, PaymentMethod } from '$lib/shared/enums';

export type PaymentCalculationMode = 'target' | 'native';

interface BaseCalculationParams {
	method: PaymentMethod;
	bcvRate: number;
	exchangeRate?: number;
}

interface CalculatePaymentAmountParams extends BaseCalculationParams {
	usdBcvAmount: number;
}

interface CalculateUsdBcvAmountParams extends BaseCalculationParams {
	paymentAmount: number;
}

export function roundCurrency(value: number): number {
	return Number(value.toFixed(2));
}

export function getDefaultPaymentCalculationMode(method: PaymentMethod): PaymentCalculationMode {
	return isBsPaymentMethod(method) ? 'target' : 'native';
}

export function calculatePaymentAmountFromUsdBcv({
	method,
	usdBcvAmount,
	bcvRate,
	exchangeRate
}: CalculatePaymentAmountParams): number {
	if (usdBcvAmount <= 0 || bcvRate <= 0) return 0;

	if (isBsPaymentMethod(method)) {
		return roundCurrency(usdBcvAmount * bcvRate);
	}

	if (!exchangeRate || exchangeRate <= 0) return 0;

	return roundCurrency((usdBcvAmount * bcvRate) / exchangeRate);
}

export function calculateUsdBcvFromPaymentAmount({
	method,
	paymentAmount,
	bcvRate,
	exchangeRate
}: CalculateUsdBcvAmountParams): number {
	if (paymentAmount <= 0 || bcvRate <= 0) return 0;

	if (isBsPaymentMethod(method)) {
		return roundCurrency(paymentAmount / bcvRate);
	}

	if (!exchangeRate || exchangeRate <= 0) return 0;

	return roundCurrency((paymentAmount * exchangeRate) / bcvRate);
}
