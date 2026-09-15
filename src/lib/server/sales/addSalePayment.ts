import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { db } from '$lib/server/db';
import { SaleStatus, isBsPaymentMethod, type PaymentMethod } from '$lib/shared/enums';
import { auditService } from '$lib/server/audit';
import { composeBusinessTimestamp } from '$lib/dates';
import { submitSalePayment } from '$lib/server/payments/salePayments';
import type { AddPaymentInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

export async function addSalePaymentCore(data: AddPaymentInput, ctx: ActionContext) {
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
				paymentDate: composeBusinessTimestamp(data.paymentDate),
				usdBcvAmount: amountBcvUsd,
				reference: data.reference ?? null,
				notes: data.notes ?? null
			},
			tx
		);
	});

	// Audit logs (best-effort, after transaction succeeds)
	await auditService.logCreate('sale_payment', payment, ctx, {
		excludeFields: ['createdAt', 'updatedAt']
	});

	return { success: true as const, payment, paidAmount };
}
