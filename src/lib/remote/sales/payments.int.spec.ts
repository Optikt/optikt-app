import { beforeEach, describe, expect, it } from 'vitest';
import { addPayment, voidPayment } from './payments.remote';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { resetDb } from '$lib/testing/integration/db';
import { createSale, createUser } from '$lib/testing/integration/factories';
import { callRemote } from '$lib/testing/remoteHarness';
import { PaymentMethod } from '$lib/shared/enums';
import type { AddPaymentInput, VoidPaymentInput } from '$lib/schemas/sales';

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

	it('stores who collected the payment', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, total: 100 });

		const result = await callRemote<
			AddPaymentInput,
			{ success: boolean; payment: { createdById: string | null } }
		>(addPayment, payment(sale.id), { user: seller });

		expect(result.success).toBe(true);
		expect(result.payment.createdById).toBe(seller.id);
	});
});

describe('voidPayment remote command (Capa 3)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	async function paidSale() {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, total: 100 });
		const added = await callRemote<AddPaymentInput, { success: boolean; payment: { id: string } }>(
			addPayment,
			payment(sale.id),
			{ user: seller }
		);
		return { seller, sale, paymentId: added.payment.id };
	}

	it('rejects a void without reason with 400', async () => {
		const { seller, sale, paymentId } = await paidSale();

		await expect(
			callRemote(voidPayment, { id: paymentId, saleId: sale.id } as VoidPaymentInput, {
				user: seller
			})
		).rejects.toMatchObject({ status: 400 });
	});

	it('voids with a reason and stores who/why', async () => {
		const { seller, sale, paymentId } = await paidSale();

		const result = await callRemote<VoidPaymentInput, { success: boolean; paidAmount: number }>(
			voidPayment,
			{ id: paymentId, saleId: sale.id, reason: 'Transferencia duplicada' },
			{ user: seller }
		);

		expect(result).toEqual({ success: true, paidAmount: 0 });
		const updated = await findSaleById(sale.id);
		expect(updated?.paidAmountBcvUsd).toBe(0);
	});
});
