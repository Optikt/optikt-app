import {
	CurrencyCode,
	PAYMENT_CURRENCY_GROUPS,
	PAYMENT_RAILS_BY_CURRENCY,
	SALES_RAILS_BY_CURRENCY,
	PaymentMethod,
	getCurrencySymbol,
	getExchangeRateLabel,
	getPaymentMethodCurrency,
	isBsPaymentMethod,
	rateTypeForCurrency,
	rateTypeForRail
} from '$lib/shared/enums';
import {
	calculatePaymentAmountFromUsdBcv,
	calculateUsdBcvFromPaymentAmount
} from '../paymentFormCalculations';
import { getPaymentMethodStrategy } from '$lib/shared/payments/strategies';
import { formatPrice } from '$lib/utils';

export type PaymentFormKind = 'sale' | 'purchase';

export interface PaymentComposerRequest {
	token: string;
	amount?: number;
	paymentDate?: string;
	reference?: string;
	notes?: string;
	paymentMethod?: PaymentMethod;
}

export interface PaymentFormProps {
	kind: 'sale' | 'purchase';
	// --- sale ---
	saleId?: string;
	remainingBcvUsd?: number;
	onPaymentAdded?: (paidAmount: number) => void;
	isCasheaSale?: boolean;
	// --- purchase ---
	purchaseOrderId?: string;
	status?: string;
	defaultBcvRate?: number;
	purchaseOrder?: import('$lib/server/db/schema').PurchaseOrder;
	payments?: import('$lib/server/db/queries/purchaseOrderPayments').PurchaseOrderPaymentWithUsers[];
	earlyPaymentBenefits?: import('$lib/server/db/schema').PurchaseOrderEarlyPaymentBenefit[];
	pendingBalanceUsd?: number;
	debtTotalUsd?: number;
	isFullyPaid?: boolean;
	settlementCurrency?: string;
	composerRequest?: PaymentComposerRequest | null;
	onFinanceChanged?: (payload: {
		payments: import('$lib/server/db/queries/purchaseOrderPayments').PurchaseOrderPaymentWithUsers[];
		earlyPaymentBenefits?: import('$lib/server/db/schema').PurchaseOrderEarlyPaymentBenefit[];
		balance: import('$lib/shared/purchaseOrderCredit').PurchaseOrderBalanceSummary;
		dueStatus: import('$lib/shared/purchaseOrderCredit').PurchaseOrderDueStatus;
	}) => void;
	// --- shared ---
	bcvRate?: number;
	drawerResetKey?: number;
	variant?: 'default' | 'drawer';
}

export function computeEffectiveBcvRate(
	kind: PaymentFormKind,
	defaultBcvRate: number,
	bcvRate: number,
	storeBcvRate: number
): number {
	return (kind === 'purchase' ? defaultBcvRate : bcvRate) > 0
		? kind === 'purchase'
			? defaultBcvRate
			: bcvRate
		: storeBcvRate;
}

export function computeRailsByCurrency(kind: PaymentFormKind) {
	return kind === 'purchase' ? PAYMENT_RAILS_BY_CURRENCY : SALES_RAILS_BY_CURRENCY;
}

export function computeSelectedCurrency(currencyKey: string | null) {
	return PAYMENT_CURRENCY_GROUPS.find((g) => g.key === currencyKey) ?? null;
}

export function computeRateType(rail: PaymentMethod | null, currencyKey: string | null) {
	if (rail && !isBsPaymentMethod(rail)) return rateTypeForRail(rail);
	return currencyKey ? rateTypeForCurrency(currencyKey) : null;
}

export function computePurchaseCurrencyCode(rail: PaymentMethod | null) {
	return rail ? getPaymentMethodCurrency(rail) : CurrencyCode.OTHER;
}

export function computeNeedsSpecificRate(
	kind: PaymentFormKind,
	rail: PaymentMethod | null,
	currencyKey: string | null,
	settlementCurrency?: string
) {
	if (!rail || !currencyKey) return false;
	// Native settlements need the debt-currency rate even when paying with Bs or
	// USD BCV, otherwise the applied-to-debt amount is computed in the wrong unit.
	if (
		kind === 'purchase' &&
		computeIsNativeSettlement(kind, settlementCurrency) &&
		settlementCurrency !== CurrencyCode.VES
	) {
		return true;
	}
	if (!isBsPaymentMethod(rail)) return true;
	return (
		currencyKey === 'EUR_BCV' ||
		currencyKey === 'USDT' ||
		currencyKey === 'PAYPAL' ||
		currencyKey === 'OTHER'
	);
}

export function computeSpecificRateLabel(
	kind: PaymentFormKind,
	rail: PaymentMethod | null,
	currencyKey: string | null,
	selectedCurrency: { rateLabel?: string } | null,
	settlementCurrency?: string
) {
	// When paying Bs/USD against a native debt, the single rate field is the
	// settlement rate (e.g. Bs per EUR), not a USD rate.
	if (
		kind === 'purchase' &&
		computeIsNativeSettlement(kind, settlementCurrency) &&
		(currencyKey === 'VES' || currencyKey === 'USD_BCV') &&
		settlementCurrency
	) {
		return getSettlementRateLabel(settlementCurrency);
	}
	if (rail && !isBsPaymentMethod(rail)) {
		const l = getExchangeRateLabel(rail);
		if (l) return l;
	}
	return selectedCurrency?.rateLabel ?? 'Tasa usada (Bs/unidad)';
}

export function computeAutoSpecificRate(
	kind: PaymentFormKind,
	rail: PaymentMethod | null,
	currencyKey: string | null,
	settlementCurrency: string | undefined,
	eurRate: number,
	usdtRate: number,
	paypalRate: number
) {
	const nativeSettlement =
		kind === 'purchase' && computeIsNativeSettlement(kind, settlementCurrency);
	if (
		nativeSettlement &&
		settlementCurrency &&
		(currencyKey === 'VES' || currencyKey === 'USD_BCV')
	) {
		return getSettlementRateValue(settlementCurrency, eurRate, usdtRate, paypalRate);
	}
	if (rail === PaymentMethod.EFECTIVO_USD) return 0;
	switch (currencyKey) {
		case 'EUR_BCV':
			return eurRate;
		case 'USDT':
			return usdtRate;
		case 'PAYPAL':
			return paypalRate;
		default:
			return 0;
	}
}

function getSettlementRateValue(
	settlementCurrency: string,
	eurRate: number,
	usdtRate: number,
	paypalRate: number
) {
	switch (settlementCurrency) {
		case CurrencyCode.EUR_BCV:
			return eurRate;
		case CurrencyCode.USDT:
			return usdtRate;
		case CurrencyCode.USD_PAYPAL:
			return paypalRate;
		default:
			return 0;
	}
}

function getSettlementRateLabel(settlementCurrency: string) {
	switch (settlementCurrency) {
		case CurrencyCode.EUR_BCV:
			return 'Tasa EUR (Bs/€)';
		case CurrencyCode.USDT:
			return 'Tasa USDT (Bs/USDT)';
		case CurrencyCode.USD_PAYPAL:
			return 'Tasa USD PayPal (Bs/$)';
		default:
			return 'Tasa de la deuda (Bs/unidad)';
	}
}

export function computeSettlementRateToVes(args: {
	kind: PaymentFormKind;
	settlementCurrency?: string;
	purchaseCurrencyCode: CurrencyCode;
	specificRateValue: number;
	bcvRate: number;
	eurRate: number;
	usdtRate: number;
	paypalRate: number;
}) {
	const {
		settlementCurrency,
		purchaseCurrencyCode,
		specificRateValue,
		bcvRate,
		eurRate,
		usdtRate,
		paypalRate
	} = args;
	if (!settlementCurrency || settlementCurrency === CurrencyCode.USD_BCV) return bcvRate;
	if (settlementCurrency === CurrencyCode.VES) return 1;

	if (purchaseCurrencyCode === settlementCurrency && specificRateValue > 0) {
		return specificRateValue;
	}
	// Bs/USD deliveries use the visible field as the settlement rate.
	if (
		(purchaseCurrencyCode === CurrencyCode.VES || purchaseCurrencyCode === CurrencyCode.USD_BCV) &&
		specificRateValue > 0
	) {
		return specificRateValue;
	}

	return getSettlementRateValue(settlementCurrency, eurRate, usdtRate, paypalRate);
}

export function computeSaleForwardUsd(
	kind: PaymentFormKind,
	rail: PaymentMethod | null,
	typedNativeAmount: number,
	activeBcvRate: number,
	specificRateValue: number
) {
	if (kind !== 'sale' || !rail) return 0;
	return calculateUsdBcvFromPaymentAmount({
		method: rail,
		paymentAmount: typedNativeAmount,
		bcvRate: activeBcvRate,
		exchangeRate: specificRateValue
	});
}

export function computeSaleReverseNative(
	kind: PaymentFormKind,
	rail: PaymentMethod | null,
	typedUsdBcvAmount: number,
	activeBcvRate: number,
	specificRateValue: number
) {
	if (kind !== 'sale' || !rail) return 0;
	return calculatePaymentAmountFromUsdBcv({
		method: rail,
		usdBcvAmount: typedUsdBcvAmount,
		bcvRate: activeBcvRate,
		exchangeRate: specificRateValue
	});
}

export function computeIsNativeSettlement(kind: PaymentFormKind, settlementCurrency?: string) {
	return (
		kind === 'purchase' && settlementCurrency != null && settlementCurrency !== CurrencyCode.USD_BCV
	);
}

export function computeSettlementSymbol(isNativeSettlement: boolean, settlementCurrency?: string) {
	return isNativeSettlement ? getCurrencySymbol(settlementCurrency!) : '';
}

export function computeRestLabelClass(overpaymentAmount: number, pendingAfterPayment: number) {
	if (overpaymentAmount > 0.01) return 'text-error';
	if (pendingAfterPayment > 0.01) return 'text-warning';
	return 'text-success';
}

export function computeReferenceConfig(rail: PaymentMethod | null) {
	return getPaymentMethodStrategy(rail).referenceConfig;
}

export function computeReferenceToSubmit(
	reference: string,
	referenceConfig: { fallbackValue?: string }
) {
	const trimmed = reference.trim();
	if (trimmed) return trimmed;
	return referenceConfig.fallbackValue;
}

export function computeHasRequiredReference(
	referenceConfig: { required: boolean },
	reference: string
) {
	return !referenceConfig.required || reference.trim().length > 0;
}

export function computeNativeLabel(rail: PaymentMethod | null) {
	return getPaymentMethodStrategy(rail).nativeLabel;
}

export function computeNativePrefix(rail: PaymentMethod | null) {
	return getPaymentMethodStrategy(rail).nativePrefix;
}

export function computeRateContextLine(args: {
	resolvedAmountUsd: number;
	activeBcvRate: number;
	kind: PaymentFormKind;
	purchaseCurrencyCode: CurrencyCode;
	rail: PaymentMethod | null;
	specificRateValue: number;
}) {
	const { resolvedAmountUsd, activeBcvRate, kind, purchaseCurrencyCode, rail, specificRateValue } =
		args;
	if (resolvedAmountUsd <= 0 || activeBcvRate <= 0) return '';
	if (kind === 'purchase' && purchaseCurrencyCode === CurrencyCode.VES) {
		return `${activeBcvRate.toFixed(2)} × ${formatPrice(resolvedAmountUsd)}`;
	}
	if (kind === 'sale' && rail && isBsPaymentMethod(rail)) {
		return `${activeBcvRate.toFixed(2)} × ${formatPrice(resolvedAmountUsd)}`;
	}
	if (specificRateValue <= 0) return '';
	return `${formatPrice(resolvedAmountUsd)} × ${activeBcvRate.toFixed(2)} ÷ ${specificRateValue.toFixed(2)}`;
}
