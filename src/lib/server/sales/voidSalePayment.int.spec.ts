import { beforeEach, describe, expect, it } from 'vitest';
import { addSalePaymentCore } from './addSalePayment';
import { voidSalePaymentCore } from './voidSalePayment';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { resetDb } from '$lib/testing/integration/db';
import { createSale, createUser } from '$lib/testing/integration/factories';
import { PaymentMethod, SaleStatus, UserRole } from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';
import type { AddPaymentInput } from '$lib/schemas/sales';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.MANAGER, ipAddress: '127.0.0.1', userAgent: null };
}

function payment(saleId: string, usdBcvAmount: number): AddPaymentInput {
	return {
		saleId,
		paymentMethod: PaymentMethod.EFECTIVO_BS,
		paymentDate: '2026-09-14',
		amount: usdBcvAmount,
		usdBcvAmount,
		bcvRate: 40
	};
}

describe('voidSalePaymentCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('voids a payment and recalculates the paid amount', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, total: 100 });
		const added = await addSalePaymentCore(payment(sale.id, 50), ctx(seller.id));
		if (!added.success) throw new Error('payment was not created');

		const result = await voidSalePaymentCore(
			{ id: added.payment.id, saleId: sale.id },
			ctx(seller.id)
		);

		expect(result).toEqual({ success: true, paidAmount: 0 });
		const updated = await findSaleById(sale.id);
		expect(updated?.paidAmountBcvUsd).toBe(0);
	});

	it('reopens a fully paid COMPLETED sale to PENDING when it becomes underpaid', async () => {
		const seller = await createUser();
		const sale = await createSale({
			sellerId: seller.id,
			status: SaleStatus.COMPLETED,
			total: 100
		});
		const added = await addSalePaymentCore(payment(sale.id, 100), ctx(seller.id));
		if (!added.success) throw new Error('payment was not created');

		const result = await voidSalePaymentCore(
			{ id: added.payment.id, saleId: sale.id },
			ctx(seller.id)
		);

		expect(result.success).toBe(true);
		const updated = await findSaleById(sale.id);
		expect(updated?.status).toBe(SaleStatus.PENDING);
		expect(updated?.completedAt).toBeNull();
	});

	it('rejects voiding a payment that belongs to another sale', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, total: 100 });
		const otherSale = await createSale({ sellerId: seller.id, total: 100 });
		const added = await addSalePaymentCore(payment(sale.id, 50), ctx(seller.id));
		if (!added.success) throw new Error('payment was not created');

		const result = await voidSalePaymentCore(
			{ id: added.payment.id, saleId: otherSale.id },
			ctx(seller.id)
		);

		expect(result).toEqual({ success: false, error: 'Pago no encontrado' });
	});
});
