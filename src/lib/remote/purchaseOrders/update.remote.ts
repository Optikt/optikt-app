/**
 * Purchase orders remote — update command
 * Split from purchaseOrders.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { getPurchaseOrderFinanceIssues, normalizeCreditTermsForWrite } from './shared';
import { command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { getErrorMessage } from '$lib/utils';

import { UpdatePurchaseOrderSchema } from '$lib/schemas/purchaseOrders';

import { findPurchaseOrderById, updatePurchaseOrder } from '$lib/server/db/queries/purchaseOrders';

import { db } from '$lib/server/db';
import { PurchaseOrderStatus, PurchasePaymentTerms } from '$lib/shared/enums';

import { auditService, getAuditContext } from '$lib/server/audit';

import type { PurchaseOrder } from '$lib/server/db/schema';

export const updatePurchaseOrderCmd = command(UpdatePurchaseOrderSchema, async (data) => {
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

	try {
		const nextPaymentTerms = data.paymentTerms ?? (existing.paymentTerms as PurchasePaymentTerms);
		const nextCreditDueDate =
			data.creditDueDate !== undefined ? data.creditDueDate : existing.creditDueDate;
		const nextEarlyPaymentDiscountPercent =
			data.earlyPaymentDiscountPercent !== undefined
				? data.earlyPaymentDiscountPercent
				: existing.earlyPaymentDiscountPercent;
		const nextEarlyPaymentDiscountDeadline =
			data.earlyPaymentDiscountDeadline !== undefined
				? data.earlyPaymentDiscountDeadline
				: existing.earlyPaymentDiscountDeadline;
		const financeIssues = getPurchaseOrderFinanceIssues({
			purchaseOrderId: data.id,
			paymentTerms: nextPaymentTerms,
			creditDueDate: nextCreditDueDate,
			earlyPaymentDiscountPercent: nextEarlyPaymentDiscountPercent,
			earlyPaymentDiscountDeadline: nextEarlyPaymentDiscountDeadline
		});
		if (financeIssues.length > 0) {
			return {
				success: false as const,
				error: `Completa la condición de pago antes de guardar: ${financeIssues.join(', ')}`
			};
		}

		const updateData: Partial<PurchaseOrder> = {};
		if (data.supplierId) updateData.supplierId = data.supplierId;
		if (data.documentType) updateData.documentType = data.documentType;
		if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber ?? null;
		if (data.deliveryNoteNumber !== undefined)
			updateData.deliveryNoteNumber = data.deliveryNoteNumber ?? null;
		if (data.orderDate) updateData.orderDate = data.orderDate;
		if (data.bcvRate !== undefined) updateData.bcvRate = data.bcvRate;
		if (data.altRate !== undefined) updateData.sourceRateToVes = data.altRate ?? null;
		if (data.sourceCurrency !== undefined) updateData.sourceCurrency = data.sourceCurrency;
		if (
			data.paymentTerms !== undefined ||
			data.creditDueDate !== undefined ||
			data.earlyPaymentDiscountPercent !== undefined ||
			data.earlyPaymentDiscountDeadline !== undefined
		) {
			Object.assign(
				updateData,
				normalizeCreditTermsForWrite({
					paymentTerms: nextPaymentTerms,
					creditDueDate: nextCreditDueDate,
					earlyPaymentDiscountPercent: nextEarlyPaymentDiscountPercent,
					earlyPaymentDiscountDeadline: nextEarlyPaymentDiscountDeadline
				})
			);
		}
		if (data.notes !== undefined) updateData.notes = data.notes ?? null;
		if (data.discount !== undefined) {
			updateData.settlementDiscountType = data.discount.type;
			updateData.settlementDiscountValue = data.discount.value;
			updateData.settlementDiscountNotes = data.discount.notes ?? null;
		}
		updateData.isReadyForReview = false;

		const updated = await db.transaction(async (tx) =>
			updatePurchaseOrder(data.id, updateData, tx)
		);

		await auditService.logUpdate('purchase_order', data.id, existing, updated, context);

		return { success: true as const, purchaseOrder: updated };
	} catch (e) {
		return {
			success: false as const,
			error: getErrorMessage(e, 'Error actualizando orden de compra')
		};
	}
});
