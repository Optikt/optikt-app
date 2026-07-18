import { CurrencyCode, PurchaseSourceCurrency } from '$lib/shared/enums';

// ============================================================================
// SOURCE-TO-CODE MAPPING
// ============================================================================

/** Maps each purchase source currency to its canonical CurrencyCode. */
export const SOURCE_TO_CURRENCY_CODE: Record<PurchaseSourceCurrency, CurrencyCode> = {
	[PurchaseSourceCurrency.USD]: CurrencyCode.USD_BCV,
	[PurchaseSourceCurrency.VES]: CurrencyCode.VES,
	[PurchaseSourceCurrency.EUR]: CurrencyCode.EUR_BCV,
	[PurchaseSourceCurrency.USDT]: CurrencyCode.USDT,
	[PurchaseSourceCurrency.PAYPAL]: CurrencyCode.USD_PAYPAL
};

/** Reverse lookup: CurrencyCode → PurchaseSourceCurrency (for settlement currency → source). */
export const CURRENCY_CODE_TO_SOURCE: Partial<Record<CurrencyCode, PurchaseSourceCurrency>> = {
	[CurrencyCode.USD_BCV]: PurchaseSourceCurrency.USD,
	[CurrencyCode.VES]: PurchaseSourceCurrency.VES,
	[CurrencyCode.EUR_BCV]: PurchaseSourceCurrency.EUR,
	[CurrencyCode.USDT]: PurchaseSourceCurrency.USDT,
	[CurrencyCode.USD_PAYPAL]: PurchaseSourceCurrency.PAYPAL
};

// ============================================================================
// RATE REQUIREMENTS
// ============================================================================

/**
 * Whether the source currency requires its own rate-to-VES for inventory-cost
 * normalization.  USD-BCV is direct; VES divides by BCV; EUR / USDT / PayPal
 * need an explicit sourceRateToVes.
 */
export function sourceCurrencyRequiresRateToVes(sourceCurrency: string): boolean {
	return (
		sourceCurrency === PurchaseSourceCurrency.EUR ||
		sourceCurrency === PurchaseSourceCurrency.USDT ||
		sourceCurrency === PurchaseSourceCurrency.PAYPAL
	);
}

/**
 * Whether the source currency is NOT USD-BCV (i.e. displays alternative-price
 * fields in the UI).  Equivalent to the existing `isAltSourceCurrency`.
 */
export function isAltDisplayCurrency(sourceCurrency: string): boolean {
	return sourceCurrency !== PurchaseSourceCurrency.USD;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Display symbol for a source currency in UI (item rows, summaries).
 * Uses the same symbols as `PURCHASE_SOURCE_CURRENCY_SYMBOLS`.
 */
export function getSourceCurrencySymbol(sourceCurrency: string): string {
	switch (sourceCurrency) {
		case PurchaseSourceCurrency.USD:
			return '$';
		case PurchaseSourceCurrency.VES:
			return 'Bs';
		case PurchaseSourceCurrency.EUR:
			return '€';
		case PurchaseSourceCurrency.USDT:
			return 'USDT';
		case PurchaseSourceCurrency.PAYPAL:
			return '$';
		default:
			return '¤';
	}
}

/** Display label for a settlement currency (uses CurrencyCode labels). */
export function getSettlementCurrencyLabel(currencyCode: string): string {
	const labels: Record<string, string> = {
		[CurrencyCode.USD_BCV]: 'USD BCV',
		[CurrencyCode.EUR_BCV]: 'EUR BCV',
		[CurrencyCode.USDT]: 'USDT',
		[CurrencyCode.USD_PAYPAL]: 'USD PayPal',
		[CurrencyCode.VES]: 'Bolívares (Bs)',
		[CurrencyCode.USD_EFECTIVO]: 'USD efectivo'
	};
	return labels[currencyCode] ?? currencyCode;
}

/** Display symbol for a settlement currency. */
export function getSettlementCurrencySymbol(currencyCode: string): string {
	switch (currencyCode) {
		case CurrencyCode.USD_BCV:
			return '$';
		case CurrencyCode.EUR_BCV:
			return '€';
		case CurrencyCode.USDT:
			return 'USDT';
		case CurrencyCode.USD_PAYPAL:
			return '$';
		case CurrencyCode.VES:
			return 'Bs';
		default:
			return '¤';
	}
}

// ============================================================================
// COST NORMALIZATION (source price → USD-BCV)
// ============================================================================

export interface SourcePriceToUsdBcvInput {
	sourceCurrency: string;
	unitPriceAlt: number;
	appliesIva: boolean;
	ivaRate: number;
	sourceRateToVes: number | null | undefined;
	bcvRate: number;
}

/**
 * Derive the USD-BCV unit purchase price (tax-included) from an alternative
 * source-currency price.  This generalizes the old VES-only / EUR-only branches
 * into a single function controlled by the source currency.
 *
 * - USD: `unitPriceAlt` is already the USD-BCV price → returned as-is.
 * - VES: `unitPriceAlt` is in Bs → `(price × tax) / bcvRate`.
 * - EUR / USDT / PayPal: `unitPriceAlt` is in the source currency →
 *   `(price × tax × sourceRateToVes) / bcvRate`.
 */
export function sourcePriceToUsdBcv(input: SourcePriceToUsdBcvInput): number {
	const price = Number(input.unitPriceAlt ?? 0);
	if (!Number.isFinite(price) || price < 0) return 0;

	const bcv = Number(input.bcvRate ?? 0);
	if (!Number.isFinite(bcv) || bcv <= 0) return 0;

	const taxMultiplier =
		input.appliesIva && input.ivaRate ? 1 + Number(input.ivaRate ?? 0) / 100 : 1;

	if (input.sourceCurrency === PurchaseSourceCurrency.USD) {
		return round2(price);
	}

	if (input.sourceCurrency === PurchaseSourceCurrency.VES) {
		return round2((price * taxMultiplier) / bcv);
	}

	// EUR, USDT, PAYPAL: go through sourceRateToVes → Bs → BCV → USD
	const rateToVes = Number(input.sourceRateToVes ?? 0);
	if (!Number.isFinite(rateToVes) || rateToVes <= 0) return 0;

	return round2((price * taxMultiplier * rateToVes) / bcv);
}

// ============================================================================
// INTERNAL
// ============================================================================

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
