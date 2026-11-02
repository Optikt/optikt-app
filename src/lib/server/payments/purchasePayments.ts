import type { DbOrTx } from '$lib/server/db/types';
import type { PurchaseOrder } from '$lib/server/db/schema';
import type { PurchasePaymentMethod, CurrencyCode } from '$lib/shared/enums';

import { getPurchaseOrderItems } from '$lib/server/db/queries/purchaseOrders/items';
import {
	createPurchaseOrderPayment,
	getNextPurchaseOrderPaymentNumber,
	getPurchaseOrderPayments,
	voidPurchaseOrderPayment as voidPurchaseOrderPaymentQuery
} from '$lib/server/db/queries/purchaseOrderPayments';
import {
	createPurchaseOrderEarlyPaymentBenefit,
	getPurchaseOrderEarlyPaymentBenefits,
	voidPurchaseOrderEarlyPaymentBenefitsByPayment
} from '$lib/server/db/queries/purchaseOrderEarlyPaymentBenefits';

import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';

export interface PurchaseOrderEarlyPaymentBenefitSubmission {
	amountUsdBcv: number;
	amountAppliedToDebt?: number;
	amountAppliedToDebtUsdBcvAtOrder?: number;
	appliedToBalance: boolean;
	note?: string;
}

export interface PurchaseOrderPaymentSubmission {
	purchaseOrder: PurchaseOrder;
	paymentMethod: PurchasePaymentMethod;
	currencyCode: CurrencyCode;
	paymentDate: string;
	benefitDate: string;
	amount: number;
	bcvUsdRate: number;
	specificRate: number | null;
	rateType: string | null;
	amountAppliedToDebt: number | null;
	amountBs: number;
	amountUsdBcv: number;
	reference: string | null;
	notes: string | null;
	earlyPaymentBenefit?: PurchaseOrderEarlyPaymentBenefitSubmission | null;
	userId: string;
}

export interface VoidPurchaseOrderPaymentSubmission {
	purchaseOrder: PurchaseOrder;
	paymentId: string;
	userId: string;
}

function roundCurrency(value: number): number {
	return Number(value.toFixed(2));
}

/** Pronto-pago terms + date window checks shared by both benefit registration paths. */
function assertProntoPagoTerms(
	purchaseOrder: PurchaseOrder,
	benefitDate: string
): { percent: number } {
	const percent = Number(purchaseOrder.earlyPaymentDiscountPercent ?? 0);
	const deadline = purchaseOrder.earlyPaymentDiscountDeadline;
	if (percent <= 0 || !deadline) {
		throw new Error('La orden no tiene pronto pago configurado');
	}
	if (benefitDate > deadline) {
		throw new Error('La fecha del beneficio debe estar dentro del plazo de pronto pago');
	}
	return { percent };
}

/** Remaining amount a new benefit may apply, in settlement currency. */
export function earlyPaymentBenefitCap(args: {
	percent: number;
	settlementDebtAmount: number;
	settlementBenefitsApplied: number;
	settlementBalance: number;
}): number {
	const percentCap = (args.settlementDebtAmount * Math.min(args.percent, 100)) / 100;
	return roundCurrency(
		Math.min(percentCap - args.settlementBenefitsApplied, args.settlementBalance)
	);
}

async function computePurchaseOrderState(purchaseOrder: PurchaseOrder, executor: DbOrTx) {
	const [items, payments, earlyPaymentBenefits] = await Promise.all([
		getPurchaseOrderItems(purchaseOrder.id, executor),
		getPurchaseOrderPayments(purchaseOrder.id, { includeVoided: true }, executor),
		getPurchaseOrderEarlyPaymentBenefits(purchaseOrder.id, { includeVoided: true }, executor)
	]);
	const balance = computePurchaseOrderBalance(
		purchaseOrder,
		items,
		payments,
		earlyPaymentBenefits,
		{
			settlementCurrency: purchaseOrder.settlementCurrency,
			settlementGrossAmount: purchaseOrder.settlementGrossAmount,
			settlementDebtAmount: purchaseOrder.settlementDebtAmount
		}
	);
	const dueStatus = getPurchaseOrderDueStatus({
		paymentTerms: purchaseOrder.paymentTerms,
		creditDueDate: purchaseOrder.creditDueDate,
		earlyPaymentDiscountDeadline: purchaseOrder.earlyPaymentDiscountDeadline,
		balance: balance.settlementBalance
	});
	return { items, payments, earlyPaymentBenefits, balance, dueStatus };
}

/** Adapter over purchase order payment + native debt amortization. Caller owns the transaction. */
export async function submitPurchaseOrderPayment(
	input: PurchaseOrderPaymentSubmission,
	executor: DbOrTx
) {
	const { purchaseOrder } = input;
	const { earlyPaymentBenefit } = input;

	if (earlyPaymentBenefit) {
		// Server-side pronto pago guard: date window + remaining % cap, inside the tx.
		const { percent } = assertProntoPagoTerms(purchaseOrder, input.benefitDate);
		const preBalance = (await computePurchaseOrderState(purchaseOrder, executor)).balance;
		const cap = earlyPaymentBenefitCap({
			percent,
			settlementDebtAmount: Number(purchaseOrder.settlementDebtAmount ?? 0),
			settlementBenefitsApplied: preBalance.settlementBenefitsApplied,
			settlementBalance: preBalance.settlementBalance
		});
		// Native deliveries must report the benefit in the order's currency: the
		// USD-BCV amount is a different unit and must not fall back into the cap
		// comparison nor persist as settlement units.
		if (
			purchaseOrder.settlementCurrency !== 'USD_BCV' &&
			!earlyPaymentBenefit.amountAppliedToDebt
		) {
			throw new Error(
				'El beneficio requiere el monto aplicado a la deuda en la moneda de la orden'
			);
		}
		const nativeApplied = Number(
			earlyPaymentBenefit.amountAppliedToDebt ?? earlyPaymentBenefit.amountUsdBcv ?? 0
		);
		if (cap <= 0) {
			throw new Error('No hay saldo pendiente ni descuento disponible para aplicar');
		}
		if (nativeApplied > cap + 0.01) {
			throw new Error(`El beneficio no puede superar ${cap.toFixed(2)}`);
		}
	}

	const paymentNumber = await getNextPurchaseOrderPaymentNumber(purchaseOrder.id, executor);

	// Compute native debt amortization
	const amountAppliedToDebt = input.amountAppliedToDebt ?? input.amountUsdBcv;
	const settlementDebtAmount = Number(purchaseOrder.settlementDebtAmount ?? 0);
	const settlementDebtAmountUsdBcvAtOrder = Number(
		purchaseOrder.settlementDebtAmountUsdBcvAtOrder ?? 0
	);
	const amountAppliedToDebtUsdBcvAtOrder =
		settlementDebtAmount > 0
			? Math.round(
					(amountAppliedToDebt / settlementDebtAmount) * settlementDebtAmountUsdBcvAtOrder * 100
				) / 100
			: amountAppliedToDebt; // fallback: same value when denominator is 0

	const payment = await createPurchaseOrderPayment(
		{
			purchaseOrderId: purchaseOrder.id,
			paymentNumber,
			paymentMethod: input.paymentMethod,
			currencyCode: input.currencyCode,
			paymentDate: input.paymentDate,
			amount: input.amount,
			bcvUsdRate: input.bcvUsdRate,
			specificRate: input.specificRate,
			rateType: input.rateType,
			amountBs: input.amountBs,
			amountUsdBcv: input.amountUsdBcv,
			amountAppliedToDebt,
			amountAppliedToDebtUsdBcvAtOrder,
			reference: input.reference,
			notes: input.notes,
			createdById: input.userId
		},
		executor
	);

	const benefit = earlyPaymentBenefit
		? await createPurchaseOrderEarlyPaymentBenefit(
				{
					purchaseOrderId: purchaseOrder.id,
					paymentId: payment.id,
					benefitDate: input.benefitDate,
					amountUsdBcv: earlyPaymentBenefit.amountUsdBcv,
					amountAppliedToDebt:
						earlyPaymentBenefit.amountAppliedToDebt ?? earlyPaymentBenefit.amountUsdBcv,
					amountAppliedToDebtUsdBcvAtOrder:
						earlyPaymentBenefit.amountAppliedToDebtUsdBcvAtOrder ??
						earlyPaymentBenefit.amountUsdBcv,
					appliedToBalance: earlyPaymentBenefit.appliedToBalance,
					note: earlyPaymentBenefit.note ?? null,
					createdById: input.userId
				},
				executor
			)
		: null;

	const { earlyPaymentBenefits, balance, dueStatus } = await computePurchaseOrderState(
		purchaseOrder,
		executor
	);

	return { payment, benefit, earlyPaymentBenefits, balance, dueStatus };
}

/** Adapter over void purchase payment + benefit void + balance recompute. Caller owns the transaction. */
export async function voidPurchaseOrderPayment(
	input: VoidPurchaseOrderPaymentSubmission,
	executor: DbOrTx
) {
	const { purchaseOrder } = input;

	const voided = await voidPurchaseOrderPaymentQuery(input.paymentId, input.userId, executor);
	if (!voided) {
		throw new Error('No se pudo anular el pago');
	}
	await voidPurchaseOrderEarlyPaymentBenefitsByPayment(input.paymentId, input.userId, executor);

	const state = await computePurchaseOrderState(purchaseOrder, executor);

	return {
		voided,
		earlyPaymentBenefits: state.earlyPaymentBenefits,
		balance: state.balance,
		dueStatus: state.dueStatus
	};
}

// ============================================================================
// STANDALONE PRONTO PAGO BENEFIT (retroactive, without a payment)
// ============================================================================

export interface RegisterEarlyPaymentBenefitSubmission {
	purchaseOrder: PurchaseOrder;
	amount: number;
	benefitDate: string;
	appliedToBalance: boolean;
	note?: string | null;
	userId: string;
}

/** USD-BCV value of a settlement-currency benefit, using the order's own rates. */
function benefitUsdEquivalent(po: PurchaseOrder, amount: number): number {
	const bcv = Number(po.bcvRate || 0);
	if (bcv <= 0) return 0;
	if (po.settlementCurrency === 'USD_BCV') return roundCurrency(amount);
	if (po.settlementCurrency === 'VES') return roundCurrency(amount / bcv);
	const rate = Number(po.sourceRateToVes || 0);
	if (rate <= 0) return 0;
	return roundCurrency((amount * rate) / bcv);
}

/** Adapter for a pronto pago benefit registered outside a payment. Caller owns the transaction. */
export async function registerPurchaseOrderEarlyPaymentBenefit(
	input: RegisterEarlyPaymentBenefitSubmission,
	executor: DbOrTx
) {
	const { purchaseOrder, amount } = input;

	const { percent } = assertProntoPagoTerms(purchaseOrder, input.benefitDate);

	const state = await computePurchaseOrderState(purchaseOrder, executor);

	const discountCap = earlyPaymentBenefitCap({
		percent,
		settlementDebtAmount: Number(purchaseOrder.settlementDebtAmount ?? 0),
		settlementBenefitsApplied: state.balance.settlementBenefitsApplied,
		settlementBalance: state.balance.settlementBalance
	});
	if (discountCap <= 0) {
		throw new Error('No hay saldo pendiente ni descuento disponible para aplicar');
	}
	if (amount > discountCap + 0.01) {
		throw new Error(`El beneficio no puede superar ${discountCap.toFixed(2)}`);
	}

	const amountUsdBcv = benefitUsdEquivalent(purchaseOrder, amount);
	if (amountUsdBcv <= 0) {
		throw new Error('No se pudo calcular el equivalente en USD BCV del beneficio');
	}

	const settlementDebtAmount = Number(purchaseOrder.settlementDebtAmount ?? 0);
	const amountAppliedToDebtUsdBcvAtOrder =
		settlementDebtAmount > 0
			? Math.round(
					(amount / settlementDebtAmount) *
						Number(purchaseOrder.settlementDebtAmountUsdBcvAtOrder ?? 0) *
						100
				) / 100
			: amountUsdBcv;

	const benefit = await createPurchaseOrderEarlyPaymentBenefit(
		{
			purchaseOrderId: purchaseOrder.id,
			paymentId: null,
			benefitDate: input.benefitDate,
			amountUsdBcv,
			amountAppliedToDebt: amount,
			amountAppliedToDebtUsdBcvAtOrder,
			appliedToBalance: input.appliedToBalance,
			note: input.note ?? null,
			createdById: input.userId
		},
		executor
	);

	const finalState = await computePurchaseOrderState(purchaseOrder, executor);

	return {
		benefit,
		earlyPaymentBenefits: finalState.earlyPaymentBenefits,
		balance: finalState.balance,
		dueStatus: finalState.dueStatus
	};
}
