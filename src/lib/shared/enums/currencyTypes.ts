/**
 * Currency Codes for exchange rate tracking
 * Used for purchase price normalization
 */
export enum CurrencyCode {
	USD_BCV = 'USD_BCV',
	EUR_BCV = 'EUR_BCV',
	USDT = 'USDT',
	USD_PAYPAL = 'USD_PAYPAL',
	USD_EFECTIVO = 'USD_EFECTIVO',
	OTHER = 'OTHER'
}

/**
 * Currency display labels
 */
export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
	[CurrencyCode.USD_BCV]: 'USD (BCV)',
	[CurrencyCode.EUR_BCV]: 'EUR (BCV)',
	[CurrencyCode.USDT]: 'USDT',
	[CurrencyCode.USD_PAYPAL]: 'USD PayPal',
	[CurrencyCode.USD_EFECTIVO]: 'USD efectivo',
	[CurrencyCode.OTHER]: 'Otra / libre'
};

/** Get the display label for a currency code, with fallback to the raw value */
export function getCurrencyLabel(code: string): string {
	return CURRENCY_LABELS[code as CurrencyCode] ?? code;
}

/**
 * Currency symbols
 */
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
	[CurrencyCode.USD_BCV]: '$',
	[CurrencyCode.EUR_BCV]: '€',
	[CurrencyCode.USDT]: '$',
	[CurrencyCode.USD_PAYPAL]: '$',
	[CurrencyCode.USD_EFECTIVO]: '$',
	[CurrencyCode.OTHER]: '¤'
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
 * Currencies currently tracked in exchange rates and purchase price normalization.
 * Keep this subset narrow even if CurrencyCode grows for other domains.
 */
export const ALL_CURRENCY_CODES = [
	CurrencyCode.USD_BCV,
	CurrencyCode.EUR_BCV,
	CurrencyCode.USDT,
	CurrencyCode.USD_PAYPAL
] as const;

/**
 * Full currency set available for purchase payment registration.
 */
export const ALL_PURCHASE_PAYMENT_CURRENCY_CODES = Object.values(CurrencyCode) as [
	CurrencyCode,
	...CurrencyCode[]
];
