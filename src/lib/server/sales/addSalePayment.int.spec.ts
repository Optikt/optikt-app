import { beforeEach, describe, expect, it } from 'vitest';
import { addSalePaymentCore } from './addSalePayment';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { resetDb } from '$lib/testing/integration/db';
import { createSale, createUser } from '$lib/testing/integration/factories';
import { PaymentMethod, SaleStatus, UserRole } from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';
import type { AddPaymentInput } from '$lib/schemas/sales';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.ADMIN, ipAddress: '127.0.0.1', userAgent: null };
}

function payment(saleId: string): AddPaymentInput {
	return {
		saleId,
		paymentMethod: PaymentMethod.EFECTIVO_BS,
		paymentDate: '2026-09-14',
		amount: 50,
		usdBcvAmount: 50,
		bcvRate: 40
	};
}

describe('addSalePaymentCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('records a payment and updates the sale paid amount', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, total: 100 });

		const result = await addSalePaymentCore(payment(sale.id), ctx(seller.id));

		expect(result.success).toBe(true);
		const updated = await findSaleById(sale.id);
		expect(updated?.paidAmountBcvUsd).toBe(50);
	});

	it('rejects a payment on a cancelled sale', async () => {
		const sale = await createSale({ status: SaleStatus.CANCELLED });

		const result = await addSalePaymentCore(payment(sale.id), ctx(sale.sellerId));

		expect(result).toEqual({
			success: false,
			error: 'No se pueden agregar pagos a una venta cancelada'
		});
	});

	it('requires an exchange rate for non-Bs methods', async () => {
		const sale = await createSale();

		const result = await addSalePaymentCore(
			{ ...payment(sale.id), paymentMethod: PaymentMethod.EFECTIVO_USD },
			ctx(sale.sellerId)
		);

		expect(result).toEqual({
			success: false,
			error: 'Tasa de cambio requerida para este método'
		});
	});

	it('returns not found for an unknown sale', async () => {
		const result = await addSalePaymentCore(payment(crypto.randomUUID()), ctx(crypto.randomUUID()));

		expect(result).toEqual({ success: false, error: 'Venta no encontrada' });
	});
});
