import { CurrencyCode } from '$lib/shared/enums';

export interface NormalizePurchasePaymentInput {
	currencyCode: CurrencyCode;
	amount: number;
	bcvUsdRate: number;
	specificRate?: number | null;
}

export interface NormalizedPurchasePaymentAmounts {
	amountBs: number;
	amountUsdBcv: number;
}

export interface DenormalizePurchasePaymentInput {
	currencyCode: CurrencyCode;
	amountUsdBcv: number;
	bcvUsdRate: number;
	specificRate?: number | null;
}

function roundCurrency(value: number): number {
	return Number(value.toFixed(2));
}

export function requiresPurchasePaymentSpecificRate(currencyCode: CurrencyCode): boolean {
	return currencyCode !== CurrencyCode.USD_BCV && currencyCode !== CurrencyCode.VES;
}

export function getPurchasePaymentSpecificRateLabel(currencyCode: CurrencyCode): string {
	switch (currencyCode) {
		case CurrencyCode.EUR_BCV:
			return 'Tasa EUR (Bs/€)';
		case CurrencyCode.USDT:
			return 'Tasa USDT (Bs/USDT)';
		case CurrencyCode.USD_PAYPAL:
			return 'Tasa USD PayPal (Bs/$)';
		case CurrencyCode.USD_EFECTIVO:
			return 'Tasa USD efectivo (Bs/$)';
		case CurrencyCode.OTHER:
			return 'Tasa usada (Bs/unidad)';
		default:
			return 'Tasa usada';
	}
}

export function normalizePurchasePaymentAmounts({
	currencyCode,
	amount,
	bcvUsdRate,
	specificRate
}: NormalizePurchasePaymentInput): NormalizedPurchasePaymentAmounts {
	if (amount <= 0 || bcvUsdRate <= 0) {
		return { amountBs: 0, amountUsdBcv: 0 };
	}

	// VES: amount is already in Bs — divide by BCV rate to get USD
	if (currencyCode === CurrencyCode.VES) {
		return {
			amountBs: roundCurrency(amount),
			amountUsdBcv: roundCurrency(amount / bcvUsdRate)
		};
	}

	if (!requiresPurchasePaymentSpecificRate(currencyCode)) {
		return {
			amountBs: roundCurrency(amount * bcvUsdRate),
			amountUsdBcv: roundCurrency(amount)
		};
	}

	if (!specificRate || specificRate <= 0) {
		return { amountBs: 0, amountUsdBcv: 0 };
	}

	const amountBs = roundCurrency(amount * specificRate);
	return {
		amountBs,
		amountUsdBcv: roundCurrency(amountBs / bcvUsdRate)
	};
}

export function denormalizePurchasePaymentAmount({
	currencyCode,
	amountUsdBcv,
	bcvUsdRate,
	specificRate
}: DenormalizePurchasePaymentInput): number {
	if (amountUsdBcv <= 0 || bcvUsdRate <= 0) {
		return 0;
	}

	if (currencyCode === CurrencyCode.VES) {
		return roundCurrency(amountUsdBcv * bcvUsdRate);
	}

	if (!requiresPurchasePaymentSpecificRate(currencyCode)) {
		return roundCurrency(amountUsdBcv);
	}

	if (!specificRate || specificRate <= 0) {
		return 0;
	}

	return roundCurrency((amountUsdBcv * bcvUsdRate) / specificRate);
}
