import { beforeEach, describe, expect, it } from 'vitest';
import { createNewQuoteCore } from './createNewQuote';
import { resetDb } from '$lib/testing/integration/db';
import {
	createCustomer,
	createMaterial,
	createProduct,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { DiscountType, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import type { ActionContext } from '$lib/server/actionContext';
import type { CreateQuoteInput, QuoteItemInput } from '$lib/schemas/quotes';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.SELLER, ipAddress: '127.0.0.1', userAgent: null };
}

function item(productId: string): QuoteItemInput {
	return {
		itemType: SaleItemType.PRODUCT,
		productId,
		quantity: 2,
		unitPrice: 20,
		discount: 0,
		discountType: DiscountType.FIXED
	};
}

async function seedProduct() {
	const supplier = await createSupplier();
	const material = await createMaterial();
	return createProduct({ supplierId: supplier.id, materialId: material.id, stock: 10 });
}

describe('createNewQuoteCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('creates a draft quote with items and computed totals', async () => {
		const seller = await createUser();
		const product = await seedProduct();
		const input: CreateQuoteInput = {
			quoteDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			items: [item(product.id)]
		};

		const result = await createNewQuoteCore(input, ctx(seller.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not created');
		expect(result.quote.total).toBeGreaterThan(0);
		expect(result.quote.customerId).toBeNull();
	});

	it('rejects a new customer whose document already exists', async () => {
		const seller = await createUser();
		const product = await seedProduct();
		await createCustomer({ idNumber: 'V-12345678' });
		const input: CreateQuoteInput = {
			newCustomer: { firstName: 'Ana', lastName: 'Pérez', idNumber: 'v-12345678' },
			quoteDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			items: [item(product.id)]
		};

		const result = await createNewQuoteCore(input, ctx(seller.id));

		expect(result).toEqual({
			success: false,
			error: 'Ya existe un cliente con ese documento'
		});
	});
});
