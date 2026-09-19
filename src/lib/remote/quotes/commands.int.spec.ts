import { describe, expect, it } from 'vitest';
import { createNewQuote, updateExistingQuote } from './commands.remote';
import { callRemote } from '$lib/testing/remoteHarness';
import { DiscountType } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';

function item() {
	return {
		itemType: SaleItemType.PRODUCT,
		productId: crypto.randomUUID(),
		quantity: 1,
		unitPrice: 20,
		discount: 0,
		discountType: DiscountType.FIXED
	};
}

describe('quotes commands (Capa 3)', () => {
	it('createNewQuote rejects an unauthenticated caller with 401', async () => {
		await expect(
			callRemote(
				createNewQuote,
				{
					quoteDate: '2026-09-15',
					discount: 0,
					discountType: DiscountType.FIXED,
					snapshotTaxRate: 16,
					items: [item()]
				},
				{ user: null }
			)
		).rejects.toMatchObject({ status: 401 });
	});

	it('updateExistingQuote rejects an unauthenticated caller with 401', async () => {
		await expect(
			callRemote(updateExistingQuote, { id: crypto.randomUUID(), items: [item()] }, { user: null })
		).rejects.toMatchObject({ status: 401 });
	});
});
