import { beforeEach, describe, expect, it } from 'vitest';
import { convertQuoteToSaleCore } from './convertQuoteToSale';
import { resetDb } from '$lib/testing/integration/db';
import { createCustomer, createQuote, createUser } from '$lib/testing/integration/factories';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { UserRole } from '$lib/shared/enums';
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
});
