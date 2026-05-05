import type { ExpenseCurrency } from '$lib/shared/enums';

interface CalculateExpenseAmountBcvUsdParams {
	currency: ExpenseCurrency;
	amount: number;
	bcvRate: number;
	exchangeRate?: number;
}

function roundCurrency(value: number): number {
	return Number(value.toFixed(2));
}

export function requiresExpenseExchangeRate(currency: ExpenseCurrency): boolean {
	return currency !== 'USD';
}

export function requiresExpenseRateType(currency: ExpenseCurrency): boolean {
	return currency === 'VES' || currency === 'EUR';
}

export function getExpenseExchangeRateLabel(currency: ExpenseCurrency): string {
	switch (currency) {
		case 'VES':
			return 'Tasa usada (Bs/USD)';
		case 'USDT':
			return 'Tasa USDT (Bs/USDT)';
		case 'EUR':
			return 'Tasa usada (EUR→USD)';
		default:
			return 'Tasa usada';
	}
}

export function calculateExpenseAmountBcvUsd({
	currency,
	amount,
	bcvRate,
	exchangeRate
}: CalculateExpenseAmountBcvUsdParams): number {
	if (amount <= 0 || bcvRate <= 0) return 0;

	if (currency === 'USD') {
		return roundCurrency(amount);
	}

	if (currency === 'VES') {
		return roundCurrency(amount / bcvRate);
	}

	if (!exchangeRate || exchangeRate <= 0) return 0;

	if (currency === 'USDT') {
		return roundCurrency((amount * exchangeRate) / bcvRate);
	}

	return roundCurrency(amount * exchangeRate);
}
