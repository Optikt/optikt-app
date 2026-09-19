import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { updateItemCostsCore } from './updateItemCosts';
import { db } from '$lib/server/db';
import { saleItems } from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import { createSaleItem, createUser } from '$lib/testing/integration/factories';
import { UserRole } from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.ADMIN, ipAddress: '127.0.0.1', userAgent: null };
}

describe('updateItemCostsCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('updates the snapshot costs of a sale item', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const item = await createSaleItem({ quantity: 2 });

		const result = await updateItemCostsCore(
			{
				saleItemId: item.id,
				snapshotBaseCost: 10,
				snapshotMountingPrice: 5,
				snapshotShippingPrice: 3,
				shippingCostPending: false
			},
			ctx(admin.id)
		);

		expect(result).toEqual({ success: true });
		const [after] = await db.select().from(saleItems).where(eq(saleItems.id, item.id));
		expect(after.snapshotBaseCost).toBe(10);
		expect(after.snapshotMountingPrice).toBe(5);
		expect(after.snapshotShippingPrice).toBe(3);
	});

	it('clears the shipping price while it is pending', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const item = await createSaleItem();

		const result = await updateItemCostsCore(
			{
				saleItemId: item.id,
				snapshotBaseCost: 10,
				snapshotMountingPrice: null,
				snapshotShippingPrice: 7,
				shippingCostPending: true
			},
			ctx(admin.id)
		);

		expect(result).toEqual({ success: true });
		const [after] = await db.select().from(saleItems).where(eq(saleItems.id, item.id));
		expect(after.snapshotShippingPrice).toBeNull();
	});

	it('returns not found for an unknown item', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });

		const result = await updateItemCostsCore(
			{
				saleItemId: crypto.randomUUID(),
				snapshotBaseCost: 1,
				snapshotMountingPrice: null,
				snapshotShippingPrice: null,
				shippingCostPending: false
			},
			ctx(admin.id)
		);

		expect(result).toEqual({ success: false, error: 'Artículo de venta no encontrado' });
	});
});
