import { beforeEach, describe, expect, it } from 'vitest';
import { addPayment } from './payments.remote';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { resetDb } from '$lib/testing/integration/db';
import { createSale, createUser } from '$lib/testing/integration/factories';
import { callRemote } from '$lib/testing/remoteHarness';
import { PaymentMethod } from '$lib/shared/enums';
import type { AddPaymentInput } from '$lib/schemas/sales';

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

describe('addPayment remote command (Capa 3)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('rejects an unauthenticated caller with 401', async () => {
		await expect(
			callRemote(addPayment, payment(crypto.randomUUID()), { user: null })
		).rejects.toMatchObject({ status: 401 });
	});

	it('rejects invalid input with 400 through the real validation hook', async () => {
		const user = await createUser();

		await expect(
			callRemote(addPayment, { ...payment(crypto.randomUUID()), usdBcvAmount: 0 }, { user })
		).rejects.toMatchObject({ status: 400 });
	});

	it('records a payment through the real command wrapper', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, total: 100 });

		const result = await callRemote<AddPaymentInput, { success: boolean }>(
			addPayment,
			payment(sale.id),
			{ user: seller }
		);

		expect(result.success).toBe(true);
		const updated = await findSaleById(sale.id);
		expect(updated?.paidAmountBcvUsd).toBe(50);
	});
});
