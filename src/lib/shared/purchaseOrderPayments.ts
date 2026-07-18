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

// ============================================================================
// EXCHANGE VARIANCE (per-payment & cumulative)
// ============================================================================

/**
 * Compute the realized exchange variance for a single payment.
 *
 * Formula:
 *   V = (amountAppliedToDebt / settlementDebtAmount) × settlementDebtAmountUsdBcvAtOrder
 *     - amountUsdBcv
 *
 * V > 0 → financial gain (paid fewer BCV than originally valued)
 * V < 0 → financial loss (paid more BCV than originally valued)
 */
export function computePaymentExchangeVariance(
	amountAppliedToDebt: number,
	settlementDebtAmount: number,
	settlementDebtAmountUsdBcvAtOrder: number,
	amountUsdBcv: number
): number {
	if (!Number.isFinite(amountAppliedToDebt) || amountAppliedToDebt <= 0) return 0;
	if (!Number.isFinite(settlementDebtAmount) || settlementDebtAmount <= 0) return 0;

	const originalBcvValue =
		(amountAppliedToDebt / settlementDebtAmount) * settlementDebtAmountUsdBcvAtOrder;
	return roundCurrency(originalBcvValue - amountUsdBcv);
}

/** Convenience: aggregate variance over active payments. */
export function computeTotalExchangeVariance(parameters: {
	settlementDebtAmount: number;
	settlementDebtAmountUsdBcvAtOrder: number;
	payments: Array<{
		amountAppliedToDebt?: number | null;
		amountUsdBcv: number;
		voidedAt?: string | null;
	}>;
}): number {
	if (parameters.settlementDebtAmount <= 0) return 0;
	return roundCurrency(
		parameters.payments
			.filter((p) => !p.voidedAt)
			.reduce((sum, p) => {
				const applied = Number(p.amountAppliedToDebt ?? p.amountUsdBcv ?? 0);
				if (applied <= 0) return sum;
				return (
					sum +
					computePaymentExchangeVariance(
						applied,
						parameters.settlementDebtAmount,
						parameters.settlementDebtAmountUsdBcvAtOrder,
						Number(p.amountUsdBcv ?? 0)
					)
				);
			}, 0)
	);
}
