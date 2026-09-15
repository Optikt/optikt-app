/**
 * Purchase orders remote — payments
 * Shell: auth + validation + audit. Logic lives in src/lib/server/payments/purchasePayments.ts.
 */
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { getErrorMessage } from '$lib/utils';
import { composeBusinessTimestamp } from '$lib/dates';

import {
	CreatePurchaseOrderPaymentSchema,
	VoidPurchaseOrderPaymentSchema
} from '$lib/schemas/purchaseOrderPayments';

import { findPurchaseOrderById } from '$lib/server/db/queries/purchaseOrders/orders';
import {
	findPurchaseOrderPaymentById,
	getPurchaseOrderPaymentsWithUsers
} from '$lib/server/db/queries/purchaseOrderPayments';

import { db } from '$lib/server/db';
import { PurchaseOrderStatus, currencyForPurchasePaymentMethod } from '$lib/shared/enums';

import { normalizePurchasePaymentAmounts } from '$lib/shared/purchaseOrderPayments';

import { auditService, getAuditContext } from '$lib/server/audit';
import {
	submitPurchaseOrderPayment,
	voidPurchaseOrderPayment
} from '$lib/server/payments/purchasePayments';

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

		const userId = context.userId;

		try {
			const result = await db.transaction(async (tx) => {
				return submitPurchaseOrderPayment(
					{
						purchaseOrder,
						paymentMethod: data.paymentMethod,
						currencyCode,
						paymentDate: composeBusinessTimestamp(data.paymentDate),
						benefitDate: data.paymentDate,
						amount: data.amount,
						bcvUsdRate: data.bcvUsdRate,
						specificRate: data.specificRate ?? null,
						rateType: data.rateType ?? null,
						amountAppliedToDebt: data.amountAppliedToDebt ?? null,
						amountBs: normalized.amountBs,
						amountUsdBcv: normalized.amountUsdBcv,
						reference: data.reference ?? null,
						notes: data.notes ?? null,
						earlyPaymentBenefit: data.earlyPaymentBenefit ?? null,
						userId
					},
					tx
				);
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

	const userId = context.userId;

	try {
		const result = await db.transaction(async (tx) => {
			return voidPurchaseOrderPayment({ purchaseOrder, paymentId: data.id, userId }, tx);
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
