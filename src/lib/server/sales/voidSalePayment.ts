import {
	findPaymentById,
	voidSalePayment,
	recalcSalePaidAmount
} from '$lib/server/db/queries/sales/payments';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { updateSale as updateSaleQuery } from '$lib/server/db/queries/sales/writes';
import { db } from '$lib/server/db';
import { SaleStatus, canManageSaleByOwner } from '$lib/shared/enums';
import { auditService } from '$lib/server/audit';
import type { VoidPaymentInput } from '$lib/schemas/sales';
import type { ActionContext } from '$lib/server/actionContext';

/**
 * Void a payment and recalculate paid amount.
 * Re-opens sale to PENDING if it was COMPLETED and is now underpaid.
 */
export async function voidSalePaymentCore(data: VoidPaymentInput, ctx: ActionContext) {
	const sale = await findSaleById(data.saleId);
	if (!sale) {
		return { success: false as const, error: 'Venta no encontrada' };
	}

	if (!canManageSaleByOwner(ctx.role, ctx.userId, sale.sellerId)) {
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
			await auditService.logUpdate('sale', data.saleId, sale, updated, ctx, {
				excludeFields: ['createdAt', 'updatedAt', 'deletedAt']
			});
		}
	}

	return { success: true as const, paidAmount };
}
