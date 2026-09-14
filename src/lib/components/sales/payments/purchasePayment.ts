import { toast } from 'svelte-sonner';
import { CurrencyCode } from '$lib/shared/enums';
import {
	computePaymentExchangeVariance,
	denormalizePurchasePaymentAmount,
	normalizePurchasePaymentAmounts
} from '$lib/shared/purchaseOrderPayments';
import {
	getEarlyPaymentDiscountSuggestion,
	type EarlyPaymentDiscountSuggestion,
	type PurchaseOrderBalanceSummary,
	type PurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';
import type { PurchaseOrder, PurchaseOrderEarlyPaymentBenefit } from '$lib/server/db/schema';
import type { PurchaseOrderPaymentWithUsers } from '$lib/server/db/queries/purchaseOrderPayments';
import { addPurchaseOrderPaymentCmd } from '$lib/remote/purchaseOrders.remote';
import { formatPrice, getErrorMessage } from '$lib/utils';
import type { PaymentFormKind } from './paymentFormDerived';

export type PurchasePaymentPayload = Parameters<typeof addPurchaseOrderPaymentCmd>[0];

export interface PurchaseAmountInput {
	purchaseCurrencyCode: CurrencyCode;
	typedNativeAmount: number;
	typedUsdBcvAmount: number;
	activeBcvRate: number;
	specificRateValue: number;
	needsSpecificRate: boolean;
}

export function computePurchaseNormalized(input: PurchaseAmountInput) {
	return normalizePurchasePaymentAmounts({
		currencyCode: input.purchaseCurrencyCode,
		amount: input.typedNativeAmount,
		bcvUsdRate: input.activeBcvRate,
		specificRate: input.needsSpecificRate ? input.specificRateValue : undefined
	});
}

export function computePurchaseReverseNative(input: PurchaseAmountInput) {
	return denormalizePurchasePaymentAmount({
		currencyCode: input.purchaseCurrencyCode,
		amountUsdBcv: input.typedUsdBcvAmount,
		bcvUsdRate: input.activeBcvRate,
		specificRate: input.needsSpecificRate ? input.specificRateValue : undefined
	});
}

export function computeAmountAppliedToDebt(args: {
	isNativeSettlement: boolean;
	purchaseCurrencyCode: string;
	specificRateValue: number;
	settlementCurrency?: string;
	resolvedNativeAmount: number;
}) {
	const {
		isNativeSettlement,
		purchaseCurrencyCode,
		specificRateValue,
		settlementCurrency,
		resolvedNativeAmount
	} = args;
	if (!isNativeSettlement) return undefined;
	if (purchaseCurrencyCode === CurrencyCode.VES && specificRateValue > 0) {
		return Math.round((resolvedNativeAmount / specificRateValue) * 100) / 100;
	}
	if (purchaseCurrencyCode === settlementCurrency) return resolvedNativeAmount;
	return undefined;
}

export function computeExchangeVariance(args: {
	isNativeSettlement: boolean;
	amountAppliedToDebt?: number;
	debtTotalUsd?: number;
	resolvedAmountUsd: number;
}) {
	const { isNativeSettlement, amountAppliedToDebt, debtTotalUsd, resolvedAmountUsd } = args;
	return isNativeSettlement && (amountAppliedToDebt ?? 0) > 0
		? computePaymentExchangeVariance(
				amountAppliedToDebt ?? 0,
				debtTotalUsd ?? 0,
				(debtTotalUsd ?? 0) > 0 ? (debtTotalUsd ?? 0) : (amountAppliedToDebt ?? 0),
				resolvedAmountUsd
			)
		: 0;
}

export function computeLiveEarlyPaymentSuggestion(args: {
	kind: PaymentFormKind;
	hasActiveEarlyPaymentBenefit: boolean;
	pendingBalanceUsd?: number;
	debtTotalUsd?: number;
	purchaseOrder?: PurchaseOrder;
	resolvedAmountUsd: number;
	paymentDate: string;
}) {
	const {
		kind,
		hasActiveEarlyPaymentBenefit,
		pendingBalanceUsd,
		debtTotalUsd,
		purchaseOrder,
		resolvedAmountUsd,
		paymentDate
	} = args;
	return kind === 'purchase' &&
		!hasActiveEarlyPaymentBenefit &&
		pendingBalanceUsd != null &&
		debtTotalUsd != null &&
		purchaseOrder
		? getEarlyPaymentDiscountSuggestion({
				terms: purchaseOrder,
				totalDebt: debtTotalUsd,
				currentBalance: pendingBalanceUsd,
				paymentAmount: resolvedAmountUsd,
				paymentDate
			})
		: null;
}

export function computeShowPurchasePreview(args: {
	purchaseNormalizedAmountBs: number;
	resolvedAmountUsd: number;
	isNativeSettlement: boolean;
	amountAppliedToDebt?: number;
	liveEarlyPaymentSuggestion: EarlyPaymentDiscountSuggestion | null;
}) {
	const {
		purchaseNormalizedAmountBs,
		resolvedAmountUsd,
		isNativeSettlement,
		amountAppliedToDebt,
		liveEarlyPaymentSuggestion
	} = args;
	return (
		purchaseNormalizedAmountBs > 0 ||
		resolvedAmountUsd > 0 ||
		(isNativeSettlement && (amountAppliedToDebt ?? 0) > 0) ||
		!!liveEarlyPaymentSuggestion
	);
}

export function buildPurchasePayload(args: {
	purchaseOrderId?: string;
	hasRail: boolean;
	paymentMethod: PurchasePaymentPayload['paymentMethod'];
	paymentDate: string;
	resolvedNativeAmount: number;
	activeBcvRate: number;
	needsSpecificRate: boolean;
	specificRateValue: number;
	amountAppliedToDebt?: number;
	rateType?: string;
	referenceToSubmit?: string;
	notes: string;
}): PurchasePaymentPayload | null {
	const {
		purchaseOrderId,
		hasRail,
		paymentMethod,
		paymentDate,
		resolvedNativeAmount,
		activeBcvRate,
		needsSpecificRate,
		specificRateValue,
		amountAppliedToDebt,
		rateType,
		referenceToSubmit,
		notes
	} = args;
	if (!purchaseOrderId || !hasRail) return null;
	return {
		purchaseOrderId,
		paymentMethod,
		paymentDate,
		amount: resolvedNativeAmount,
		bcvUsdRate: activeBcvRate,
		specificRate: needsSpecificRate ? specificRateValue : undefined,
		amountAppliedToDebt: amountAppliedToDebt ?? undefined,
		rateType: rateType ?? undefined,
		reference: referenceToSubmit,
		notes: notes.trim() || undefined
	};
}

export interface PurchaseSubmitCallbacks {
	setSubmitting: (value: boolean) => void;
	onFinanceChanged?: (payload: {
		payments: PurchaseOrderPaymentWithUsers[];
		earlyPaymentBenefits?: PurchaseOrderEarlyPaymentBenefit[];
		balance: PurchaseOrderBalanceSummary;
		dueStatus: PurchaseOrderDueStatus;
	}) => void;
	partialReset: () => void;
}

export async function submitPurchasePayment(
	payload: PurchasePaymentPayload,
	callbacks: PurchaseSubmitCallbacks
) {
	callbacks.setSubmitting(true);
	try {
		const result = await addPurchaseOrderPaymentCmd(payload);
		if (!result.success) {
			toast.error(result.error ?? 'Error registrando pago');
			return;
		}
		callbacks.onFinanceChanged?.({
			payments: result.payments,
			earlyPaymentBenefits: result.earlyPaymentBenefits,
			balance: result.balance,
			dueStatus: result.dueStatus
		});
		toast.success('Pago registrado');
		callbacks.partialReset();
	} catch (error) {
		toast.error(getErrorMessage(error, 'Error registrando pago'));
	} finally {
		callbacks.setSubmitting(false);
	}
}

export interface PurchaseFlowState {
	pendingBalanceUsd?: number;
	resolvedAmountUsd: number;
	purchaseCurrencyCode: CurrencyCode;
	liveEarlyPaymentSuggestion: EarlyPaymentDiscountSuggestion | null;
	pendingAddPayload: PurchasePaymentPayload | null;
	pendingBenefitSuggestion: EarlyPaymentDiscountSuggestion | null;
	benefitAmountInput: string;
	benefitNoteInput: string;
	isNativeSettlement: boolean;
	activeBcvRate: number;
	needsSpecificRate: boolean;
	specificRateValue: number;
}

export interface PurchaseSubmitSnapshot extends PurchaseFlowState {
	purchaseOrderId?: string;
	hasRail: boolean;
	paymentMethod: PurchasePaymentPayload['paymentMethod'];
	paymentDate: string;
	rateType?: string;
	referenceToSubmit?: string;
	notes: string;
	resolvedNativeAmount: number;
	amountAppliedToDebt?: number;
}

export function createPurchaseSubmitApi(
	getSnapshot: () => PurchaseSubmitSnapshot,
	mut: PurchaseFlowMutations
) {
	return {
		submit() {
			const snap = getSnapshot();
			return maybeSubmitPurchase(
				buildPurchasePayload({
					purchaseOrderId: snap.purchaseOrderId,
					hasRail: snap.hasRail,
					paymentMethod: snap.paymentMethod,
					paymentDate: snap.paymentDate,
					resolvedNativeAmount: snap.resolvedNativeAmount,
					activeBcvRate: snap.activeBcvRate,
					needsSpecificRate: snap.needsSpecificRate,
					specificRateValue: snap.specificRateValue,
					amountAppliedToDebt: snap.amountAppliedToDebt,
					rateType: snap.rateType,
					referenceToSubmit: snap.referenceToSubmit,
					notes: snap.notes
				}),
				snap,
				mut
			);
		},
		async confirmOverpayment() {
			mut.setShowOverpaymentModal(false);
			const snap = getSnapshot();
			if (snap.pendingAddPayload) await submitPurchasePayment(snap.pendingAddPayload, mut);
			mut.setPendingAddPayload(null);
		},
		cancelOverpayment() {
			mut.setShowOverpaymentModal(false);
			mut.setPendingAddPayload(null);
		},
		applyBenefit() {
			return submitPaymentWithBenefit(true, getSnapshot(), mut);
		},
		noteBenefit() {
			return submitPaymentWithBenefit(false, getSnapshot(), mut);
		},
		cancelBenefit() {
			mut.setShowEarlyPaymentBenefitModal(false);
			mut.setPendingAddPayload(null);
			mut.resetEarlyPaymentState();
		}
	};
}

export interface PurchaseFlowMutations extends PurchaseSubmitCallbacks {
	setPendingAddPayload: (payload: PurchasePaymentPayload | null) => void;
	setShowOverpaymentModal: (value: boolean) => void;
	setPendingBenefitSuggestion: (suggestion: EarlyPaymentDiscountSuggestion | null) => void;
	setBenefitAmountInput: (value: string) => void;
	setBenefitNoteInput: (value: string) => void;
	setShowEarlyPaymentBenefitModal: (value: boolean) => void;
	resetEarlyPaymentState: () => void;
}

export async function maybeSubmitPurchase(
	payload: PurchasePaymentPayload | null,
	state: PurchaseFlowState,
	mutations: PurchaseFlowMutations
) {
	if (!payload) return;

	if (state.pendingBalanceUsd != null && state.resolvedAmountUsd > state.pendingBalanceUsd + 0.01) {
		mutations.setPendingAddPayload(payload);
		mutations.setShowOverpaymentModal(true);
		return;
	}
	if (state.liveEarlyPaymentSuggestion) {
		mutations.setPendingAddPayload(payload);
		mutations.setPendingBenefitSuggestion(state.liveEarlyPaymentSuggestion);
		mutations.setBenefitAmountInput(state.liveEarlyPaymentSuggestion.amount.toFixed(2));
		mutations.setBenefitNoteInput('');
		mutations.setShowEarlyPaymentBenefitModal(true);
		return;
	}
	await submitPurchasePayment(payload, mutations);
}

export async function submitPaymentWithBenefit(
	appliedToBalance: boolean,
	state: PurchaseFlowState,
	mutations: PurchaseFlowMutations
) {
	if (!state.pendingAddPayload || !state.pendingBenefitSuggestion) return;
	const amountUsdBcv = Number(state.benefitAmountInput || 0);
	if (!Number.isFinite(amountUsdBcv) || amountUsdBcv <= 0) {
		toast.error('Monto de beneficio inválido');
		return;
	}
	if (amountUsdBcv > state.pendingBenefitSuggestion.amount + 0.01) {
		toast.error(
			`El beneficio no debe superar ${formatPrice(state.pendingBenefitSuggestion.amount)}`
		);
		return;
	}
	if (appliedToBalance && amountUsdBcv >= state.pendingBenefitSuggestion.currentBalance - 0.01) {
		toast.error('El beneficio aplicado no puede igualar o superar el saldo pendiente');
		return;
	}

	let payload: PurchasePaymentPayload = {
		...state.pendingAddPayload,
		earlyPaymentBenefit: {
			amountUsdBcv,
			amountAppliedToDebt: state.isNativeSettlement ? amountUsdBcv : undefined,
			amountAppliedToDebtUsdBcvAtOrder: state.isNativeSettlement ? amountUsdBcv : undefined,
			appliedToBalance,
			note: state.benefitNoteInput || undefined
		}
	};

	if (appliedToBalance) {
		const adjustedPaymentUsdBcv = Math.max(
			state.pendingBenefitSuggestion.currentBalance - amountUsdBcv,
			0
		);
		const adjustedAmount = denormalizePurchasePaymentAmount({
			currencyCode: state.purchaseCurrencyCode,
			amountUsdBcv: adjustedPaymentUsdBcv,
			bcvUsdRate: state.activeBcvRate,
			specificRate: state.needsSpecificRate ? state.specificRateValue : undefined
		});
		if (!Number.isFinite(adjustedAmount) || adjustedAmount <= 0) {
			toast.error('No se pudo ajustar el monto del pago con el pronto pago');
			return;
		}
		payload = { ...payload, amount: adjustedAmount };
	}

	mutations.setPendingAddPayload(null);
	mutations.resetEarlyPaymentState();
	await submitPurchasePayment(payload, mutations);
}
