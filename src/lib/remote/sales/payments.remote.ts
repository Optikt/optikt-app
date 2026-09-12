/**
 * Sales remote — sale payments
 * Split from sales.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { command } from '$app/server';
import { requireRole } from '$lib/server/guards';
import { AddPaymentSchema, VoidPaymentSchema } from '$lib/schemas/';
import {
	findSaleById,
	findPaymentById,
	voidSalePayment,
	recalcSalePaidAmount,
	updateSale as updateSaleQuery
} from '$lib/server/db/queries/sales';

import { db } from '$lib/server/db';
import {
	SaleStatus,
	isBsPaymentMethod,
	type PaymentMethod,
	UserRole,
	canManageSaleByOwner
} from '$lib/shared/enums';

import { auditService, getAuditContext } from '$lib/server/audit';

import { submitSalePayment } from '$lib/server/payments/salePayments';

export const addPayment = command(AddPaymentSchema, async (data) => {
	requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const context = getAuditContext();

	const sale = await findSaleById(data.saleId);
	if (!sale) {
		return { success: false as const, error: 'Venta no encontrada' };
	}
	if (sale.status === SaleStatus.CANCELLED) {
		return { success: false as const, error: 'No se pueden agregar pagos a una venta cancelada' };
	}

	// Use the user-entered USD BCV amount directly (avoids floating-point drift from back-calculation)
	const method = data.paymentMethod as PaymentMethod;
	const amountBcvUsd = data.usdBcvAmount;

	if (!isBsPaymentMethod(method) && !data.exchangeRate) {
		return { success: false as const, error: 'Tasa de cambio requerida para este método' };
	}

	// All writes in a single transaction: payment + recalc + auto-complete
	const { payment, paidAmount } = await db.transaction(async (tx) => {
		return submitSalePayment(
			{
				saleId: data.saleId,
				paymentMethod: data.paymentMethod,
				amount: data.amount,
				exchangeRate: data.exchangeRate ?? null,
				rateType: data.rateType ?? null,
				isCasheaPayment: data.isCasheaPayment ?? false,
				bcvRate: data.bcvRate,
				paymentDate: data.paymentDate,
				usdBcvAmount: amountBcvUsd,
				reference: data.reference ?? null,
				notes: data.notes ?? null
			},
			tx
		);
	});

	// Audit logs (best-effort, after transaction succeeds)
	await auditService.logCreate('sale_payment', payment, context, {
		excludeFields: ['createdAt', 'updatedAt']
	});

	return { success: true as const, payment, paidAmount };
});

/**
 * Void a payment and recalculate paid amount.
 * Re-opens sale to PENDING if it was COMPLETED and is now underpaid.
 */
export const voidPayment = command(VoidPaymentSchema, async (data) => {
	const user = requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const context = getAuditContext();

	const sale = await findSaleById(data.saleId);
	if (!sale) {
		return { success: false as const, error: 'Venta no encontrada' };
	}

	if (!canManageSaleByOwner(user.role, user.id, sale.sellerId)) {
		return { success: false as const, error: 'No tienes permisos para anular pagos de esta venta' };
	}

	const payment = await findPaymentById(data.id);
	if (!payment || payment.saleId !== data.saleId) {
		return { success: false as const, error: 'Pago no encontrado' };
	}

	// All writes in a single transaction: void + recalc + status revert
	const paidAmount = await db.transaction(async (tx) => {
		const voided = await voidSalePayment(data.id, tx);
		if (!voided) {
			throw new Error('No se pudo anular el pago');
		}

		const newPaidAmount = await recalcSalePaidAmount(data.saleId, tx);

		// If sale was COMPLETED but now underpaid, revert to PENDING and clear completedAt.
		if (sale.status === SaleStatus.COMPLETED && newPaidAmount < sale.total - 0.01) {
			await updateSaleQuery(data.saleId, { status: SaleStatus.PENDING, completedAt: null }, tx);
		}
		// If sale was READY (fully paid) but now underpaid, reopen to IN_PROGRESS.
		else if (sale.status === SaleStatus.READY && newPaidAmount < sale.total - 0.01) {
			await updateSaleQuery(data.saleId, { status: SaleStatus.IN_PROGRESS }, tx);
		}

		return newPaidAmount;
	});

	// Audit log (best-effort, after transaction succeeds)
	const statusChangedByVoid =
		(sale.status === SaleStatus.COMPLETED || sale.status === SaleStatus.READY) &&
		paidAmount < sale.total - 0.01;
	if (statusChangedByVoid) {
		const updated = await findSaleById(data.saleId);
		if (updated) {
			await auditService.logUpdate('sale', data.saleId, sale, updated, context, {
				excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
			});
		}
	}

	return { success: true as const, paidAmount };
});

/**
 * Cancel a sale and restore stock for product/lens items.
 */
