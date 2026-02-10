/**
 * Currency Codes for exchange rate tracking
 * Used for purchase price normalization
 */
export enum CurrencyCode {
	USD_BCV = 'USD_BCV',
	EUR_BCV = 'EUR_BCV',
	USDT = 'USDT',
	USD_PAYPAL = 'USD_PAYPAL'
}

/**
 * Currency display labels
 */
export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
	[CurrencyCode.USD_BCV]: 'USD (BCV)',
	[CurrencyCode.EUR_BCV]: 'EUR (BCV)',
	[CurrencyCode.USDT]: 'USDT',
	[CurrencyCode.USD_PAYPAL]: 'USD PayPal'
};

/**
 * Currency symbols
 */
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
	[CurrencyCode.USD_BCV]: '$',
	[CurrencyCode.EUR_BCV]: '€',
	[CurrencyCode.USDT]: '$',
	[CurrencyCode.USD_PAYPAL]: '$'
};

/**
 * Base currency for sales (all prices normalized to this)
 */
export const BASE_CURRENCY = CurrencyCode.USD_BCV;

/**
 * Check if a currency is the base currency
 */
export function isBaseCurrency(code: CurrencyCode): boolean {
	return code === BASE_CURRENCY;
}

/**
 * Get all currency codes as array
 */
export const ALL_CURRENCY_CODES = Object.values(CurrencyCode);
