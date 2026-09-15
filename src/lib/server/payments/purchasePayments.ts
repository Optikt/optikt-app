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

/** Adapter over purchase order payment + native debt amortization. Caller owns the transaction. */
export async function submitPurchaseOrderPayment(
	input: PurchaseOrderPaymentSubmission,
	executor: DbOrTx
) {
	const { purchaseOrder } = input;

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

	const benefit = input.earlyPaymentBenefit
		? await createPurchaseOrderEarlyPaymentBenefit(
				{
					purchaseOrderId: purchaseOrder.id,
					paymentId: payment.id,
					benefitDate: input.benefitDate,
					amountUsdBcv: input.earlyPaymentBenefit.amountUsdBcv,
					amountAppliedToDebt:
						input.earlyPaymentBenefit.amountAppliedToDebt ?? input.earlyPaymentBenefit.amountUsdBcv,
					amountAppliedToDebtUsdBcvAtOrder:
						input.earlyPaymentBenefit.amountAppliedToDebtUsdBcvAtOrder ??
						input.earlyPaymentBenefit.amountUsdBcv,
					appliedToBalance: input.earlyPaymentBenefit.appliedToBalance,
					note: input.earlyPaymentBenefit.note ?? null,
					createdById: input.userId
				},
				executor
			)
		: null;

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

	return { voided, earlyPaymentBenefits, balance, dueStatus };
}
