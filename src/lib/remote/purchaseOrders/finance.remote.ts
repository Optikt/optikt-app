/**
 * Purchase orders remote — credit terms + price suggestions
 * Split from purchaseOrders.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { normalizeCreditTermsForWrite } from './helpers';
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { getErrorMessage } from '$lib/utils';

import { ApplyPriceSuggestionsSchema } from '$lib/schemas/purchaseOrders';

import { SetPurchaseOrderCreditTermsSchema } from '$lib/schemas/purchaseOrderCreditSchedule';
import {
	findPurchaseOrderById,
	updatePurchaseOrder,
	getPurchaseOrderItems
} from '$lib/server/db/queries/purchaseOrders';
import { getPurchaseOrderPayments } from '$lib/server/db/queries/purchaseOrderPayments';

import { getPurchaseOrderEarlyPaymentBenefits } from '$lib/server/db/queries/purchaseOrderEarlyPaymentBenefits';
import { updateProduct, findProductById } from '$lib/server/db/queries/products';

import { db } from '$lib/server/db';
import { PurchaseOrderStatus } from '$lib/shared/enums';

import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';

import { auditService, getAuditContext } from '$lib/server/audit';

export const setPurchaseOrderCreditTermsCmd = command(
	SetPurchaseOrderCreditTermsSchema,
	async (data) => {
		requireAdmin();

		const context = getAuditContext();
		const purchaseOrder = await findPurchaseOrderById(data.purchaseOrderId);
		if (!purchaseOrder) {
			return { success: false as const, error: 'Orden de compra no encontrada' };
		}
		if (purchaseOrder.status === PurchaseOrderStatus.CANCELLED) {
			return {
				success: false as const,
				error: 'No se puede configurar crédito en una orden cancelada'
			};
		}

		try {
			const result = await db.transaction(async (tx) => {
				const creditTerms = normalizeCreditTermsForWrite({
					paymentTerms: data.paymentTerms,
					creditDueDate: data.creditDueDate,
					earlyPaymentDiscountPercent: data.earlyPaymentDiscountPercent,
					earlyPaymentDiscountDeadline: data.earlyPaymentDiscountDeadline
				});
				const updatedPurchaseOrder = await updatePurchaseOrder(
					data.purchaseOrderId,
					creditTerms,
					tx
				);

				const [items, payments, earlyPaymentBenefits] = await Promise.all([
					getPurchaseOrderItems(data.purchaseOrderId, tx),
					getPurchaseOrderPayments(data.purchaseOrderId, { includeVoided: true }, tx),
					getPurchaseOrderEarlyPaymentBenefits(data.purchaseOrderId, { includeVoided: true }, tx)
				]);

				const balance = computePurchaseOrderBalance(
					updatedPurchaseOrder,
					items,
					payments,
					earlyPaymentBenefits,
					{
						settlementCurrency: updatedPurchaseOrder.settlementCurrency,
						settlementGrossAmount: updatedPurchaseOrder.settlementGrossAmount,
						settlementDebtAmount: updatedPurchaseOrder.settlementDebtAmount
					}
				);
				const dueStatus = getPurchaseOrderDueStatus({
					paymentTerms: updatedPurchaseOrder.paymentTerms,
					creditDueDate: updatedPurchaseOrder.creditDueDate,
					earlyPaymentDiscountDeadline: updatedPurchaseOrder.earlyPaymentDiscountDeadline,
					balance: balance.settlementBalance
				});

				return { updatedPurchaseOrder, earlyPaymentBenefits, balance, dueStatus };
			});

			await auditService.logCustom(
				'purchase_order',
				data.purchaseOrderId,
				'update',
				{
					paymentTerms: {
						old: purchaseOrder.paymentTerms,
						new: result.updatedPurchaseOrder.paymentTerms
					},
					creditDueDate: {
						old: purchaseOrder.creditDueDate,
						new: result.updatedPurchaseOrder.creditDueDate
					},
					earlyPaymentDiscountPercent: {
						old: purchaseOrder.earlyPaymentDiscountPercent,
						new: result.updatedPurchaseOrder.earlyPaymentDiscountPercent
					},
					earlyPaymentDiscountDeadline: {
						old: purchaseOrder.earlyPaymentDiscountDeadline,
						new: result.updatedPurchaseOrder.earlyPaymentDiscountDeadline
					}
				},
				context
			);

			return {
				success: true as const,
				purchaseOrder: result.updatedPurchaseOrder,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			};
		} catch (e) {
			return {
				success: false as const,
				error: getErrorMessage(e, 'Error configurando crédito')
			};
		}
	}
);

export const applyPriceSuggestionsCmd = command(ApplyPriceSuggestionsSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	if (!context.userId) {
		return { success: false as const, error: 'No autorizado' };
	}

	try {
		const results: { productId: string; updated: boolean }[] = [];

		for (const { productId, newSalePrice } of data.updates) {
			const product = await findProductById(productId);
			if (!product) {
				results.push({ productId, updated: false });
				continue;
			}

			const old = { currentSalePrice: product.currentSalePrice };
			await updateProduct(productId, { currentSalePrice: newSalePrice });
			await auditService.logUpdate(
				'product' as never,
				productId,
				old,
				{ currentSalePrice: newSalePrice },
				context
			);
			results.push({ productId, updated: true });
		}

		const updatedCount = results.filter((r) => r.updated).length;
		return { success: true as const, updatedCount };
	} catch (e) {
		return {
			success: false as const,
			error: getErrorMessage(e, 'Error actualizando precios')
		};
	}
});
