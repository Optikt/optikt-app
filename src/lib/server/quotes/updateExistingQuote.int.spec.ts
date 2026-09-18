import { beforeEach, describe, expect, it } from 'vitest';
import { createNewQuoteCore } from './createNewQuote';
import { updateExistingQuoteCore } from './updateExistingQuote';
import { resetDb } from '$lib/testing/integration/db';
import {
	createMaterial,
	createProduct,
	createQuote,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { DiscountType, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import type { ActionContext } from '$lib/server/actionContext';
import type { CreateQuoteInput, QuoteItemInput, UpdateQuoteInput } from '$lib/schemas/quotes';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.SELLER, ipAddress: '127.0.0.1', userAgent: null };
}

function item(productId: string, unitPrice = 20): QuoteItemInput {
	return {
		itemType: SaleItemType.PRODUCT,
		productId,
		quantity: 1,
		unitPrice,
		discount: 0,
		discountType: DiscountType.FIXED
	};
}

async function seedProduct() {
	const supplier = await createSupplier();
	const material = await createMaterial();
	return createProduct({ supplierId: supplier.id, materialId: material.id, stock: 10 });
}

describe('updateExistingQuoteCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('replaces items and updates the header', async () => {
		const seller = await createUser();
		const product = await seedProduct();
		const createInput: CreateQuoteInput = {
			quoteDate: '2026-09-15',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			items: [item(product.id)]
		};
		const created = await createNewQuoteCore(createInput, ctx(seller.id));
		if (!created.success) throw new Error('quote was not created');

		const update: UpdateQuoteInput = {
			id: created.quote.id,
			notes: 'editado',
			items: [item(product.id, 30)]
		};

		const result = await updateExistingQuoteCore(update, ctx(seller.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not updated');
		expect(result.quote.notes).toBe('editado');
		expect(result.quote.total).toBeGreaterThan(0);
	});

	it('rejects a quote that is not in draft', async () => {
		const quote = await createQuote({ status: QuoteStatus.CONVERTED });
		const update: UpdateQuoteInput = { id: quote.id, items: [item(crypto.randomUUID())] };

		const result = await updateExistingQuoteCore(update, ctx(quote.sellerId));

		expect(result).toEqual({
			success: false,
			error: 'Solo se pueden editar presupuestos en borrador'
		});
	});

	it('returns not found for an unknown quote', async () => {
		const update: UpdateQuoteInput = {
			id: crypto.randomUUID(),
			items: [item(crypto.randomUUID())]
		};

		const result = await updateExistingQuoteCore(update, ctx(crypto.randomUUID()));

		expect(result).toEqual({ success: false, error: 'Presupuesto no encontrado' });
	});
});
