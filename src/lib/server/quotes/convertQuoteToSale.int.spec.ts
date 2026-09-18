import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { convertQuoteToSaleCore } from './convertQuoteToSale';
import { db } from '$lib/server/db';
import { quoteItems, quotes, saleItems } from '$lib/server/db/schema';
import { buildQuoteItemValues } from '$lib/remote/quotes/helpers';
import { resetDb } from '$lib/testing/integration/db';
import {
	createCustomer,
	createInventoryLot,
	createMaterial,
	createProduct,
	createQuote,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { DiscountType, UserRole } from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';
import { nowISO } from '$lib/dates';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.SELLER, ipAddress: '127.0.0.1', userAgent: null };
}

describe('convertQuoteToSaleCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('returns not found for an unknown quote', async () => {
		const result = await convertQuoteToSaleCore(
			{ id: crypto.randomUUID() },
			ctx(crypto.randomUUID())
		);

		expect(result).toEqual({ success: false, error: 'Presupuesto no encontrado' });
	});

	it('rejects a quote that is not in draft', async () => {
		const quote = await createQuote({ status: QuoteStatus.CONVERTED });

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(quote.sellerId));

		expect(result).toEqual({
			success: false,
			error: 'Solo se pueden convertir presupuestos en borrador'
		});
	});

	it('requires the quote to have an assigned customer', async () => {
		const quote = await createQuote();

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(quote.sellerId));

		expect(result).toEqual({
			success: false,
			error: 'El presupuesto debe tener un cliente asignado para convertirlo a venta'
		});
	});

	it('rejects a quote without items', async () => {
		const customer = await createCustomer();
		const seller = await createUser();
		const quote = await createQuote({ customerId: customer.id, sellerId: seller.id });

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(seller.id));

		expect(result).toEqual({ success: false, error: 'El presupuesto no tiene ítems' });
	});

	it('converts a draft quote into a sale and marks the quote as CONVERTED', async () => {
		const seller = await createUser();
		const customer = await createCustomer();
		const supplier = await createSupplier();
		const material = await createMaterial();
		const product = await createProduct({
			supplierId: supplier.id,
			materialId: material.id,
			stock: 5
		});
		await createInventoryLot({
			productId: product.id,
			quantityInitial: 5,
			quantityAvailable: 5
		});
		const quote = await createQuote({ customerId: customer.id, sellerId: seller.id });
		await db.insert(quoteItems).values(
			buildQuoteItemValues(
				{
					itemType: SaleItemType.PRODUCT,
					productId: product.id,
					quantity: 1,
					unitPrice: 20,
					discount: 0,
					discountType: DiscountType.FIXED
				},
				quote.id,
				nowISO()
			)
		);

		const result = await convertQuoteToSaleCore({ id: quote.id }, ctx(seller.id));

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('quote was not converted');
		const [quoteAfter] = await db.select().from(quotes).where(eq(quotes.id, quote.id));
		const items = await db.select().from(saleItems).where(eq(saleItems.saleId, result.sale.id));
		expect(quoteAfter.status).toBe(QuoteStatus.CONVERTED);
		expect(quoteAfter.conversionSaleId).toBe(result.sale.id);
		expect(items).toHaveLength(1);
	});
});
