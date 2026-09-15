import { beforeEach, describe, expect, it } from 'vitest';
import { setSaleStatusCore } from './setSaleStatus';
import { resetDb } from '$lib/testing/integration/db';
import { createSale, createUser } from '$lib/testing/integration/factories';
import { SaleStatus, UserRole } from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';
import type { SetSaleStatusInput } from '$lib/schemas/sales';

function ctx(userId: string, role: UserRole): ActionContext {
	return { userId, role, ipAddress: '127.0.0.1', userAgent: null };
}

describe('setSaleStatusCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('moves a sale forward and sets completedAt when entering COMPLETED', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id });

		const toInProgress = await setSaleStatusCore(
			{ id: sale.id, status: SaleStatus.IN_PROGRESS },
			ctx(seller.id, UserRole.SELLER)
		);
		expect(toInProgress.success).toBe(true);

		const input: SetSaleStatusInput = { id: sale.id, status: SaleStatus.COMPLETED };
		const toCompleted = await setSaleStatusCore(input, ctx(seller.id, UserRole.SELLER));

		expect(toCompleted.success).toBe(true);
		if (toCompleted.success) {
			expect(toCompleted.sale.status).toBe(SaleStatus.COMPLETED);
			expect(toCompleted.sale.completedAt).not.toBeNull();
		}
	});

	it('blocks a non-admin from reverting a sale', async () => {
		const seller = await createUser();
		const sale = await createSale({ sellerId: seller.id, status: SaleStatus.IN_PROGRESS });

		const result = await setSaleStatusCore(
			{ id: sale.id, status: SaleStatus.PENDING, reason: 'corrección' },
			ctx(seller.id, UserRole.SELLER)
		);

		expect(result).toEqual({
			success: false,
			error: 'Solo administradores pueden revertir el estado de una venta'
		});
	});

	it('requires a reason for an admin revert', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const sale = await createSale({ sellerId: admin.id, status: SaleStatus.IN_PROGRESS });

		const result = await setSaleStatusCore(
			{ id: sale.id, status: SaleStatus.PENDING },
			ctx(admin.id, UserRole.ADMIN)
		);

		expect(result).toEqual({
			success: false,
			error: 'El motivo es obligatorio para revertir el estado'
		});
	});

	it('rejects changing the status of a cancelled sale', async () => {
		const sale = await createSale({ status: SaleStatus.CANCELLED });

		const result = await setSaleStatusCore(
			{ id: sale.id, status: SaleStatus.IN_PROGRESS },
			ctx(sale.sellerId, UserRole.ADMIN)
		);

		expect(result).toEqual({
			success: false,
			error: 'No se puede cambiar el estado de una venta cancelada'
		});
	});
});
