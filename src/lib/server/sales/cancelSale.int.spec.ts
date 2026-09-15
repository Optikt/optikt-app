import { beforeEach, describe, expect, it } from 'vitest';
import { cancelSaleCore } from './cancelSale';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { resetDb } from '$lib/testing/integration/db';
import { createSale, createUser } from '$lib/testing/integration/factories';
import { RefundStatus, SaleStatus, UserRole } from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';
import type { CancelSaleInput } from '$lib/schemas/sales';

function ctx(userId: string, role: UserRole): ActionContext {
	return { userId, role, ipAddress: '127.0.0.1', userAgent: null };
}

function cancelInput(id: string): CancelSaleInput {
	return { id, reason: 'Motivo de cancelación de prueba', refundStatus: RefundStatus.RETAINED };
}

describe('cancelSaleCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('cancels a sale and marks no refund when there were no payments', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });

		const result = await cancelSaleCore(cancelInput(sale.id), ctx(seller.id, UserRole.SELLER));

		expect(result).toEqual({ success: true });
		const updated = await findSaleById(sale.id);
		expect(updated?.status).toBe(SaleStatus.CANCELLED);
		expect(updated?.refundStatus).toBe(RefundStatus.NO_PAYMENT);
	});

	it('blocks a seller that does not own the sale', async () => {
		const owner = await createUser();
		const other = await createUser();
		const sale = await createSale({ sellerId: owner.id });

		const result = await cancelSaleCore(cancelInput(sale.id), ctx(other.id, UserRole.SELLER));

		expect(result).toEqual({
			success: false,
			error: 'No tienes permisos para cancelar esta venta'
		});
	});

	it('rejects an already cancelled sale', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, status: SaleStatus.CANCELLED });

		const result = await cancelSaleCore(cancelInput(sale.id), ctx(seller.id, UserRole.SELLER));

		expect(result).toEqual({ success: false, error: 'La venta ya está cancelada' });
	});
});
