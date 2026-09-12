/**
 * Purchase orders remote — payments
 * Split from purchaseOrders.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { getErrorMessage } from '$lib/utils';

import {
	CreatePurchaseOrderPaymentSchema,
	VoidPurchaseOrderPaymentSchema
} from '$lib/schemas/purchaseOrderPayments';

import {
	findPurchaseOrderById,
	getPurchaseOrderItems
} from '$lib/server/db/queries/purchaseOrders';
import {
	createPurchaseOrderPayment,
	findPurchaseOrderPaymentById,
	getNextPurchaseOrderPaymentNumber,
	getPurchaseOrderPayments,
	getPurchaseOrderPaymentsWithUsers,
	voidPurchaseOrderPayment
} from '$lib/server/db/queries/purchaseOrderPayments';

import {
	createPurchaseOrderEarlyPaymentBenefit,
	getPurchaseOrderEarlyPaymentBenefits,
	voidPurchaseOrderEarlyPaymentBenefitsByPayment
} from '$lib/server/db/queries/purchaseOrderEarlyPaymentBenefits';

import { db } from '$lib/server/db';
import { PurchaseOrderStatus, currencyForPurchasePaymentMethod } from '$lib/shared/enums';

import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';
import { normalizePurchasePaymentAmounts } from '$lib/shared/purchaseOrderPayments';

import { auditService, getAuditContext } from '$lib/server/audit';

export const addPurchaseOrderPaymentCmd = command(
	CreatePurchaseOrderPaymentSchema,
	async (data) => {
		requireAdmin();

		const context = getAuditContext();
		if (!context.userId) {
			return { success: false as const, error: 'No autorizado' };
		}

		const purchaseOrder = await findPurchaseOrderById(data.purchaseOrderId);
		if (!purchaseOrder) {
			return { success: false as const, error: 'Orden de compra no encontrada' };
		}
		if (purchaseOrder.status !== PurchaseOrderStatus.CONFIRMED) {
			return {
				success: false as const,
				error: 'Solo se pueden registrar pagos en órdenes confirmadas'
			};
		}

		const currencyCode = currencyForPurchasePaymentMethod(data.paymentMethod);

		const normalized = normalizePurchasePaymentAmounts({
			currencyCode,
			amount: data.amount,
			bcvUsdRate: data.bcvUsdRate,
			specificRate: data.specificRate
		});

		if (normalized.amountBs <= 0 || normalized.amountUsdBcv <= 0) {
			return {
				success: false as const,
				error: 'No se pudo calcular el equivalente en USD BCV del pago'
			};
		}

		try {
			const result = await db.transaction(async (tx) => {
				const paymentNumber = await getNextPurchaseOrderPaymentNumber(data.purchaseOrderId, tx);

				// Compute native debt amortization
				const amountAppliedToDebt =
					data.amountAppliedToDebt ??
					// Default: assume currency = settlementCurrency (USD_BCV legacy orders)
					normalized.amountUsdBcv;
				const settlementDebtAmount = Number(purchaseOrder.settlementDebtAmount ?? 0);
				const settlementDebtAmountUsdBcvAtOrder = Number(
					purchaseOrder.settlementDebtAmountUsdBcvAtOrder ?? 0
				);
				const amountAppliedToDebtUsdBcvAtOrder =
					settlementDebtAmount > 0
						? Math.round(
								(amountAppliedToDebt / settlementDebtAmount) *
									settlementDebtAmountUsdBcvAtOrder *
									100
							) / 100
						: amountAppliedToDebt; // fallback: same value when denominator is 0

				const payment = await createPurchaseOrderPayment(
					{
						purchaseOrderId: data.purchaseOrderId,
						paymentNumber,
						paymentMethod: data.paymentMethod,
						currencyCode,
						paymentDate: data.paymentDate,
						amount: data.amount,
						bcvUsdRate: data.bcvUsdRate,
						specificRate: data.specificRate ?? null,
						rateType: data.rateType ?? null,
						amountBs: normalized.amountBs,
						amountUsdBcv: normalized.amountUsdBcv,
						amountAppliedToDebt,
						amountAppliedToDebtUsdBcvAtOrder,
						reference: data.reference ?? null,
						notes: data.notes ?? null,
						createdById: context.userId!
					},
					tx
				);
				const benefit = data.earlyPaymentBenefit
					? await createPurchaseOrderEarlyPaymentBenefit(
							{
								purchaseOrderId: data.purchaseOrderId,
								paymentId: payment.id,
								benefitDate: data.paymentDate,
								amountUsdBcv: data.earlyPaymentBenefit.amountUsdBcv,
								amountAppliedToDebt:
									data.earlyPaymentBenefit.amountAppliedToDebt ??
									data.earlyPaymentBenefit.amountUsdBcv,
								amountAppliedToDebtUsdBcvAtOrder:
									data.earlyPaymentBenefit.amountAppliedToDebtUsdBcvAtOrder ??
									data.earlyPaymentBenefit.amountUsdBcv,
								appliedToBalance: data.earlyPaymentBenefit.appliedToBalance,
								note: data.earlyPaymentBenefit.note ?? null,
								createdById: context.userId!
							},
							tx
						)
					: null;

				const [items, payments, earlyPaymentBenefits] = await Promise.all([
					getPurchaseOrderItems(data.purchaseOrderId, tx),
					getPurchaseOrderPayments(data.purchaseOrderId, { includeVoided: true }, tx),
					getPurchaseOrderEarlyPaymentBenefits(data.purchaseOrderId, { includeVoided: true }, tx)
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
			});

			await auditService.logCreate('purchase_order_payment', result.payment, context, {
				excludeFields: ['createdAt', 'updatedAt']
			});
			if (result.benefit) {
				await auditService.logCreate(
					'purchase_order_early_payment_benefit',
					result.benefit,
					context,
					{
						excludeFields: ['createdAt', 'updatedAt']
					}
				);
			}

			const payments = await getPurchaseOrderPaymentsWithUsers(data.purchaseOrderId, {
				includeVoided: true
			});

			return {
				success: true as const,
				payments,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			};
		} catch (e) {
			return {
				success: false as const,
				error: getErrorMessage(e, 'Error registrando pago')
			};
		}
	}
);

export const voidPurchaseOrderPaymentCmd = command(VoidPurchaseOrderPaymentSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	if (!context.userId) {
		return { success: false as const, error: 'No autorizado' };
	}
	const purchaseOrder = await findPurchaseOrderById(data.purchaseOrderId);
	if (!purchaseOrder) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}

	const payment = await findPurchaseOrderPaymentById(data.id);
	if (!payment || payment.purchaseOrderId !== data.purchaseOrderId) {
		return { success: false as const, error: 'Pago no encontrado' };
	}

	try {
		const userId = context.userId;
		const result = await db.transaction(async (tx) => {
			const voided = await voidPurchaseOrderPayment(data.id, userId, tx);
			if (!voided) {
				throw new Error('No se pudo anular el pago');
			}
			await voidPurchaseOrderEarlyPaymentBenefitsByPayment(data.id, userId, tx);

			const [items, payments, earlyPaymentBenefits] = await Promise.all([
				getPurchaseOrderItems(data.purchaseOrderId, tx),
				getPurchaseOrderPayments(data.purchaseOrderId, { includeVoided: true }, tx),
				getPurchaseOrderEarlyPaymentBenefits(data.purchaseOrderId, { includeVoided: true }, tx)
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
		});

		await auditService.logUpdate(
			'purchase_order_payment',
			data.id,
			payment,
			result.voided,
			context,
			{ excludeFields: ['createdAt', 'updatedAt'] }
		);

		const payments = await getPurchaseOrderPaymentsWithUsers(data.purchaseOrderId, {
			includeVoided: true
		});

		return {
			success: true as const,
			voided: result.voided,
			payments,
			earlyPaymentBenefits: result.earlyPaymentBenefits,
			balance: result.balance,
			dueStatus: result.dueStatus
		};
	} catch (e) {
		return {
			success: false as const,
			error: getErrorMessage(e, 'Error anulando pago')
		};
	}
});
