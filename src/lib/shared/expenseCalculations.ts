import { CurrencyCode, isBaseCurrency } from '$lib/shared/enums/currencyTypes';
import type { ExpenseCurrency } from '$lib/shared/enums/cashTypes';
import { EXPENSE_TO_CURRENCY_CODE } from '$lib/shared/enums/cashTypes';

interface CalculateExpenseAmountBcvUsdParams {
	currency: ExpenseCurrency;
	amount: number;
	bcvRate: number;
	exchangeRate?: number;
}

function roundCurrency(value: number): number {
	return Number(value.toFixed(2));
}

function toCurrencyCode(c: ExpenseCurrency): CurrencyCode {
	return EXPENSE_TO_CURRENCY_CODE[c];
}

export function requiresExpenseExchangeRate(currency: ExpenseCurrency): boolean {
	return !isBaseCurrency(toCurrencyCode(currency));
}

export function requiresExpenseRateType(currency: ExpenseCurrency): boolean {
	const cc = toCurrencyCode(currency);
	return cc === CurrencyCode.VES || cc === CurrencyCode.EUR_BCV;
}

export function getExpenseExchangeRateLabel(currency: ExpenseCurrency): string {
	switch (toCurrencyCode(currency)) {
		case CurrencyCode.VES:
			return 'Tasa usada (Bs/USD)';
		case CurrencyCode.USDT:
			return 'Tasa USDT (Bs/USDT)';
		case CurrencyCode.EUR_BCV:
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

	const cc = toCurrencyCode(currency);

	if (cc === CurrencyCode.USD_BCV) {
		return roundCurrency(amount);
	}

	if (cc === CurrencyCode.VES) {
		return roundCurrency(amount / bcvRate);
	}

	if (!exchangeRate || exchangeRate <= 0) return 0;

	if (cc === CurrencyCode.USDT) {
		return roundCurrency((amount * exchangeRate) / bcvRate);
	}

	return roundCurrency(amount * exchangeRate);
}
