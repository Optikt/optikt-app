import { beforeEach, describe, expect, it } from 'vitest';
import { updateSaleCore } from './updateSale';
import { findSaleById } from '$lib/server/db/queries/sales/reads';
import { resetDb } from '$lib/testing/integration/db';
import { createSale, createUser } from '$lib/testing/integration/factories';
import { SaleStatus, UserRole } from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string, role: UserRole = UserRole.ADMIN): ActionContext {
	return { userId, role, ipAddress: '127.0.0.1', userAgent: null };
}

describe('updateSaleCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('updates header fields without touching items', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'ajuste de nota', notes: 'nota actualizada' },
			ctx(seller.id)
		);

		expect(result.success).toBe(true);
		const updated = await findSaleById(sale.id);
		expect(updated?.notes).toBe('nota actualizada');
	});

	it('blocks editing a COMPLETED sale', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, status: SaleStatus.COMPLETED });

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'intento de edición', notes: 'x' },
			ctx(seller.id)
		);

		expect(result).toEqual({
			success: false,
			error: 'No se puede modificar una venta completada'
		});
	});

	it('blocks a discount that drops the total below the paid amount', async () => {
		const seller = await createUser();
		const sale = await createSale({
			sellerId: seller.id,
			subtotal: 100,
			total: 100,
			paidAmountBcvUsd: 100
		});

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'descuento', discount: 50 },
			ctx(seller.id)
		);

		expect(result).toEqual({
			success: false,
			error:
				'La modificación reduce el total por debajo de lo ya cobrado. Por favor cancele esta venta y cree una nueva.'
		});
	});

	it('rejects an empty items array', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'sin items', items: [] },
			ctx(seller.id)
		);

		expect(result).toEqual({
			success: false,
			error: 'La venta debe tener al menos un artículo'
		});
	});
});
