import { describe, expect, it } from 'vitest';
import { createSale } from './commands.remote';
import { callRemote } from '$lib/testing/remoteHarness';
import { DiscountType, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { CreateSaleInput } from '$lib/schemas/sales';

function input(): CreateSaleInput {
	return {
		customerId: crypto.randomUUID(),
		saleDate: '2026-09-15',
		discount: 0,
		discountType: DiscountType.FIXED,
		snapshotTaxRate: 16,
		items: [
			{
				itemType: SaleItemType.PRODUCT,
				productId: crypto.randomUUID(),
				quantity: 1,
				unitPrice: 20,
				discount: 0,
				discountType: DiscountType.FIXED
			}
		]
	};
}

describe('createSale remote command (Capa 3)', () => {
	it('rejects an unauthenticated caller with 401', async () => {
		await expect(callRemote(createSale, input(), { user: null })).rejects.toMatchObject({
			status: 401
		});
	});

	it('rejects invalid input with 400 through the real validation hook', async () => {
		const user = { id: crypto.randomUUID(), role: UserRole.ADMIN };

		await expect(callRemote(createSale, { ...input(), items: [] }, { user })).rejects.toMatchObject(
			{ status: 400 }
		);
	});
});
