/**
 * Purchase orders remote — create command
 * Split from purchaseOrders.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { getPurchaseOrderFinanceIssues, normalizeCreditTermsForWrite } from './helpers';
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { getErrorMessage } from '$lib/utils';

import { CreatePurchaseOrderSchema } from '$lib/schemas/purchaseOrders';

import {
	createPurchaseOrder,
	createPurchaseOrderItems,
	updatePurchaseOrder,
	getNextPONumber
} from '$lib/server/db/queries/purchaseOrders';

import { db } from '$lib/server/db';
import { PurchaseOrderStatus } from '$lib/shared/enums';
import { assignPurchaseOrderLineNumbers } from '$lib/shared/purchaseOrderLineNumbers';

import { SOURCE_TO_CURRENCY_CODE } from '$lib/shared/purchaseOrderCurrencies';
import { auditService, getAuditContext } from '$lib/server/audit';

export const createPurchaseOrderCmd = command(CreatePurchaseOrderSchema, async (data) => {
	requireAdmin();

	const context = getAuditContext();
	if (!context.userId) {
		return { success: false as const, error: 'No autorizado' };
	}

	const financeIssues = getPurchaseOrderFinanceIssues({
		purchaseOrderId: data.supplierId,
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
			const orderNumber = await getNextPONumber(tx);
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

			const po = await createPurchaseOrder(
				{
					orderNumber,
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
					status: PurchaseOrderStatus.DRAFT,
					isReadyForReview: false,
					createdById: context.userId!
				},
				tx
			);

			const itemsData = assignPurchaseOrderLineNumbers(
				data.items.map((item) => ({
					purchaseOrderId: po.id,
					itemType: item.itemType,
					productId: item.productId ?? null,
					lensCatalogItemId: item.lensCatalogItemId ?? null,
					quantity: item.quantity,
					unitPurchasePrice: item.unitPurchasePrice,
					unitPurchasePriceAlt: item.unitPurchasePriceAlt ?? null,
					unitSalePrice: item.unitSalePrice,
					isZeroPriceIntentional: item.isZeroPriceIntentional ?? false,
					appliesIva: item.appliesIva,
					ivaRate: item.ivaRate,
					isReviewed: item.isReviewed ?? false
				}))
			);

			await createPurchaseOrderItems(itemsData, tx);

			// Compute and persist settlement amounts from items
			const isNativeSettlement = settlementCurrency !== 'USD_BCV';
			const gross = itemsData.reduce(
				(sum, item) =>
					sum +
					(isNativeSettlement
						? Number(item.unitPurchasePriceAlt ?? item.unitPurchasePrice ?? 0)
						: Number(item.unitPurchasePrice || 0)) *
						Number(item.quantity || 0),
				0
			);
			const usdBcvGross = itemsData.reduce(
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
				await updatePurchaseOrder(po.id, settlementUpdate, tx);
			}

			return po;
		});

		await auditService.logCreate('purchase_order', result, context);

		return { success: true as const, purchaseOrder: result };
	} catch (e) {
		return {
			success: false as const,
			error: getErrorMessage(e, 'Error creando orden de compra')
		};
	}
});
