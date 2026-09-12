/**
 * Purchase orders remote — save draft
 * Split from purchaseOrders.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import {
	getPurchaseOrderFinanceIssues,
	normalizeCreditTermsForWrite,
	toPurchaseOrderItemDraftInput
} from './shared';
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { getErrorMessage } from '$lib/utils';

import { SavePurchaseOrderDraftSchema } from '$lib/schemas/purchaseOrders';

import {
	findPurchaseOrderById,
	replacePurchaseOrderItems,
	updatePurchaseOrder
} from '$lib/server/db/queries/purchaseOrders';

import { db } from '$lib/server/db';
import { PurchaseOrderStatus } from '$lib/shared/enums';

import { SOURCE_TO_CURRENCY_CODE } from '$lib/shared/purchaseOrderCurrencies';
import { auditService, getAuditContext } from '$lib/server/audit';

export const savePurchaseOrderDraftCmd = command(SavePurchaseOrderDraftSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	const existing = await findPurchaseOrderById(data.id);
	if (!existing) {
		return { success: false as const, error: 'Orden de compra no encontrada' };
	}
	if (existing.status !== PurchaseOrderStatus.DRAFT) {
		return { success: false as const, error: 'Solo se pueden editar órdenes en borrador' };
	}
	if (existing.isReadyForReview) {
		return {
			success: false as const,
			error: 'La orden está lista para revisar. Vuelve a borrador antes de editarla.'
		};
	}

	const financeIssues = getPurchaseOrderFinanceIssues({
		purchaseOrderId: data.id,
		paymentTerms: data.paymentTerms,
		creditDueDate: data.creditDueDate,
		earlyPaymentDiscountPercent: data.earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline: data.earlyPaymentDiscountDeadline
	});
	if (financeIssues.length > 0) {
		return {
			success: false as const,
			error: `Completa la condición de pago antes de guardar: ${financeIssues.join(', ')}`
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

			const sourceCurrency = data.sourceCurrency ?? 'USD';
			const settlementCurrency =
				data.settlementCurrency ??
				SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
				'USD_BCV';

			const updated = await updatePurchaseOrder(
				data.id,
				{
					supplierId: data.supplierId,
					documentType: data.documentType,
					invoiceNumber: data.invoiceNumber ?? null,
					deliveryNoteNumber: data.deliveryNoteNumber ?? null,
					orderDate: data.orderDate,
					bcvRate: data.bcvRate,
					sourceRateToVes: data.altRate ?? null,
					sourceCurrency: data.sourceCurrency,
					settlementCurrency,
					...creditTerms,
					notes: data.notes,
					settlementDiscountType: data.discount?.type ?? 'NONE',
					settlementDiscountValue: data.discount?.value ?? 0,
					settlementDiscountNotes: data.discount?.notes ?? null,
					isReadyForReview: false
				},
				tx
			);

			const items = await replacePurchaseOrderItems(
				data.id,
				data.items.map(toPurchaseOrderItemDraftInput),
				tx
			);

			// Compute and persist settlement amounts from items
			const isNativeSettlement = settlementCurrency !== 'USD_BCV';
			const gross = items.reduce(
				(sum, item) =>
					sum +
					(isNativeSettlement
						? Number(item.unitPurchasePriceAlt ?? item.unitPurchasePrice ?? 0)
						: Number(item.unitPurchasePrice || 0)) *
						Number(item.quantity || 0),
				0
			);
			const usdBcvGross = items.reduce(
				(sum, item) => sum + Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0),
				0
			);
			const discountType = data.discount?.type;
			const discountValue = Number(data.discount?.value ?? 0);
			let settlementDebtAmount = gross;
			let discountFactor = 1;
			if (discountType === 'PERCENT' && discountValue > 0) {
				discountFactor = 1 - Math.min(discountValue, 100) / 100;
				settlementDebtAmount = gross * discountFactor;
			} else if (discountType === 'AMOUNT' && discountValue > 0) {
				settlementDebtAmount = Math.max(0, gross - discountValue);
				discountFactor = gross > 0 ? settlementDebtAmount / gross : 0;
			}
			const settlementUpdate = {
				settlementGrossAmount: data.settlementGrossAmount ?? gross,
				settlementDebtAmount: data.settlementDebtAmount ?? settlementDebtAmount,
				settlementDebtAmountUsdBcvAtOrder: isNativeSettlement
					? Math.round(usdBcvGross * discountFactor * 100) / 100
					: settlementDebtAmount
			};
			if (
				settlementUpdate.settlementGrossAmount !== 0 ||
				settlementUpdate.settlementDebtAmount !== 0
			) {
				await updatePurchaseOrder(data.id, settlementUpdate, tx);
			}

			return { purchaseOrder: { ...updated, ...settlementUpdate }, items };
		});

		await auditService.logUpdate(
			'purchase_order',
			data.id,
			existing,
			result.purchaseOrder,
			context
		);

		return { success: true as const, ...result };
	} catch (e) {
		return {
			success: false as const,
			error: getErrorMessage(e, 'Error guardando borrador de compra')
		};
	}
});
