import { PaymentMethod, type CurrencyCode } from '$lib/shared/enums';
import type { PurchaseOrder } from '$lib/server/db/schema';
import { formatPrice } from '$lib/utils';
import {
	computeAmountAppliedToDebt,
	computeExchangeVariance,
	computeLiveEarlyPaymentSuggestion,
	computePurchaseNormalized,
	computePurchaseReverseNative,
	computeShowPurchasePreview
} from './purchasePayment';
import {
	computeAutoSpecificRate,
	computeEffectiveBcvRate,
	computeHasRequiredReference,
	computeIsNativeSettlement,
	computeNativeLabel,
	computeNativePrefix,
	computeNeedsSpecificRate,
	computePurchaseCurrencyCode,
	computeRailsByCurrency,
	computeRateContextLine,
	computeRateType,
	computeReferenceConfig,
	computeReferenceToSubmit,
	computeRestLabelClass,
	computeSaleForwardUsd,
	computeSaleReverseNative,
	computeSelectedCurrency,
	computeSettlementSymbol,
	computeSpecificRateLabel,
	type PaymentFormKind,
	type PaymentFormProps
} from './paymentFormDerived';

/** Plain snapshot of the form fields, so the money math stays a pure function. */
export interface PaymentFormSelectionValues {
	currencyKey: string | null;
	rail: PaymentMethod | null;
	lastEditedAmount: 'native' | 'usd';
	nativeAmountInput: string;
	usdBcvAmountInput: string;
	bcvRateInput: string;
	specificRateInput: string;
	paymentDate: string;
	reference: string;
}

export interface PaymentFormValueInputs {
	props: PaymentFormProps;
	selection: PaymentFormSelectionValues;
	storeBcvRate: number;
	eurRate: number;
	usdtRate: number;
	paypalRate: number;
}

function inputToNumber(value: string): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatInputValue(value: number): string {
	return value > 0 ? value.toFixed(2) : '';
}

export function computePaymentFormValues(inputs: PaymentFormValueInputs) {
	const { props, selection: sel } = inputs;
	const kind: PaymentFormKind = props.kind;

	const effectiveBcvRate = computeEffectiveBcvRate(
		kind,
		props.defaultBcvRate ?? 0,
		props.bcvRate ?? 0,
		inputs.storeBcvRate
	);
	const defaultBcvRateInput = effectiveBcvRate > 0 ? effectiveBcvRate.toFixed(2) : '';
	const canManagePurchasePayments =
		kind === 'purchase' && props.status === 'CONFIRMED' && !props.isFullyPaid;

	const isNativeSettlement = computeIsNativeSettlement(kind, props.settlementCurrency);
	const settlementSymbol = computeSettlementSymbol(isNativeSettlement, props.settlementCurrency);
	const railsByCurrency = computeRailsByCurrency(kind);
	const selectedCurrency = computeSelectedCurrency(sel.currencyKey);
	const rateType = computeRateType(sel.rail, sel.currencyKey);
	const purchaseCurrencyCode = computePurchaseCurrencyCode(sel.rail);
	const needsSpecificRate = computeNeedsSpecificRate(sel.rail, sel.currencyKey);
	const specificRateLabel = computeSpecificRateLabel(sel.rail, selectedCurrency);
	const autoSpecificRate = computeAutoSpecificRate(
		sel.rail,
		sel.currencyKey,
		inputs.eurRate,
		inputs.usdtRate,
		inputs.paypalRate
	);

	const activeBcvRate = inputToNumber(sel.bcvRateInput || defaultBcvRateInput);
	const specificRateValue = inputToNumber(sel.specificRateInput);
	const typedNativeAmount = inputToNumber(sel.nativeAmountInput);
	const typedUsdBcvAmount = inputToNumber(sel.usdBcvAmountInput);

	const saleForwardUsd = computeSaleForwardUsd(
		kind,
		sel.rail,
		typedNativeAmount,
		activeBcvRate,
		specificRateValue
	);
	const saleReverseNative = computeSaleReverseNative(
		kind,
		sel.rail,
		typedUsdBcvAmount,
		activeBcvRate,
		specificRateValue
	);
	const purchaseNormalized = computePurchaseNormalized({
		purchaseCurrencyCode,
		typedNativeAmount,
		typedUsdBcvAmount,
		activeBcvRate,
		specificRateValue,
		needsSpecificRate
	});
	const purchaseReverseNative = computePurchaseReverseNative({
		purchaseCurrencyCode,
		typedNativeAmount,
		typedUsdBcvAmount,
		activeBcvRate,
		specificRateValue,
		needsSpecificRate
	});

	const forwardUsd = kind === 'sale' ? saleForwardUsd : purchaseNormalized.amountUsdBcv;
	const reverseNative = kind === 'sale' ? saleReverseNative : purchaseReverseNative;
	const resolvedAmountUsd = sel.lastEditedAmount === 'usd' ? typedUsdBcvAmount : forwardUsd;
	const resolvedNativeAmount =
		sel.lastEditedAmount === 'native' ? typedNativeAmount : reverseNative;
	const usdFieldValue =
		sel.lastEditedAmount === 'usd' ? sel.usdBcvAmountInput : formatInputValue(forwardUsd);
	const nativeFieldValue =
		sel.lastEditedAmount === 'native' ? sel.nativeAmountInput : formatInputValue(reverseNative);

	const amountAppliedToDebt = computeAmountAppliedToDebt({
		isNativeSettlement,
		purchaseCurrencyCode,
		specificRateValue,
		settlementCurrency: props.settlementCurrency,
		resolvedNativeAmount
	});
	const exchangeVariance = computeExchangeVariance({
		isNativeSettlement,
		amountAppliedToDebt,
		debtTotalUsd: props.debtTotalUsd,
		resolvedAmountUsd
	});

	const debtBalanceUsd =
		kind === 'sale' ? (props.remainingBcvUsd ?? 0) : (props.pendingBalanceUsd ?? 0);
	const overpaymentAmount = Math.max(0, resolvedAmountUsd - debtBalanceUsd);
	const pendingAfterPayment = Math.max(0, debtBalanceUsd - resolvedAmountUsd);
	const restLabelClass = computeRestLabelClass(overpaymentAmount, pendingAfterPayment);

	const hasActiveEarlyPaymentBenefit = (props.earlyPaymentBenefits ?? []).some(
		(benefit) => !benefit.voidedAt
	);
	const liveEarlyPaymentSuggestion = computeLiveEarlyPaymentSuggestion({
		kind,
		hasActiveEarlyPaymentBenefit,
		pendingBalanceUsd: props.pendingBalanceUsd,
		debtTotalUsd: props.debtTotalUsd,
		purchaseOrder: props.purchaseOrder as PurchaseOrder | undefined,
		resolvedAmountUsd,
		paymentDate: sel.paymentDate
	});
	const showPurchasePreview = computeShowPurchasePreview({
		purchaseNormalizedAmountBs: purchaseNormalized.amountBs,
		resolvedAmountUsd,
		isNativeSettlement,
		amountAppliedToDebt,
		liveEarlyPaymentSuggestion
	});

	const resolvedUsdDisplay = formatPrice(resolvedAmountUsd);
	const overpaymentDisplay = formatPrice(overpaymentAmount);

	const referenceConfig = computeReferenceConfig(sel.rail);
	const referenceToSubmit = computeReferenceToSubmit(sel.reference, referenceConfig);
	const hasRequiredReference = computeHasRequiredReference(referenceConfig, sel.reference);
	const nativeLabel = computeNativeLabel(sel.rail);
	const nativePrefix = computeNativePrefix(sel.rail);
	const rateContextLine = computeRateContextLine({
		resolvedAmountUsd,
		activeBcvRate,
		kind,
		purchaseCurrencyCode: purchaseCurrencyCode as CurrencyCode,
		rail: sel.rail,
		specificRateValue
	});

	const hasValidAmounts = resolvedAmountUsd > 0 && resolvedNativeAmount > 0;
	const hasValidRate = activeBcvRate > 0 && (!needsSpecificRate || specificRateValue > 0);

	return {
		effectiveBcvRate,
		defaultBcvRateInput,
		canManagePurchasePayments,
		isNativeSettlement,
		settlementSymbol,
		railsByCurrency,
		selectedCurrency,
		rateType,
		purchaseCurrencyCode,
		needsSpecificRate,
		specificRateLabel,
		autoSpecificRate,
		activeBcvRate,
		specificRateValue,
		typedNativeAmount,
		typedUsdBcvAmount,
		forwardUsd,
		reverseNative,
		purchaseNormalized,
		resolvedAmountUsd,
		resolvedNativeAmount,
		usdFieldValue,
		nativeFieldValue,
		amountAppliedToDebt,
		exchangeVariance,
		debtBalanceUsd,
		overpaymentAmount,
		pendingAfterPayment,
		restLabelClass,
		hasActiveEarlyPaymentBenefit,
		liveEarlyPaymentSuggestion,
		showPurchasePreview,
		resolvedUsdDisplay,
		overpaymentDisplay,
		referenceConfig,
		referenceToSubmit,
		hasRequiredReference,
		nativeLabel,
		nativePrefix,
		rateContextLine,
		hasValidAmounts,
		hasValidRate
	};
}

export type PaymentFormValues = ReturnType<typeof computePaymentFormValues>;
