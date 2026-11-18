import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '$lib/testing/integration/db';
import { createCustomer, createQuote, createUser } from '$lib/testing/integration/factories';
import {
	countQuotes,
	countQuotesByStatus,
	getAllQuotes,
	getQuoteNumberPreview,
	getQuoteStats,
	listQuoteSellers,
	sumQuotesForSelection
} from './list';
import { markQuoteConverted } from './conversion';
import { monthStart, toUTCString } from '$lib/dates';
import { QuoteStatus } from '$lib/shared/contracts/quotes';

/** Consultas del listado de quotes (mismo patrón que `sales/list.int.spec.ts`). */
describe('consultas del listado de presupuestos', () => {
	beforeEach(async () => {
		await resetDb();
	});

	describe('getQuoteStats', () => {
		it('la tasa de conversión usa la MISMA cohorte mensual (numerador ≤ denominador)', async () => {
			const now = toUTCString(monthStart());
			const oldDate = new Date(now);
			oldDate.setUTCMonth(oldDate.getUTCMonth() - 1);
			const old = toUTCString(oldDate);

			await createQuote({ quoteDate: now, status: QuoteStatus.DRAFT, total: 100 });
			await createQuote({ quoteDate: now, status: QuoteStatus.CONVERTED, total: 200 });
			// Convertido este mes pero creado el mes pasado: NO entra en monthlyConverted.
			await createQuote({ quoteDate: old, status: QuoteStatus.CONVERTED, total: 300 });

			const stats = await getQuoteStats(now);
			expect(stats.monthly).toBe(2);
			expect(stats.monthlyConverted).toBe(1);
			expect(stats.monthlyConverted).toBeLessThanOrEqual(stats.monthly);
			expect(stats.monthlyTotal).toBe(300);
			expect(stats.open).toBe(1);
			expect(stats.converted).toBe(2);
		});

		it('reporta ceros con la DB vacía', async () => {
			const stats = await getQuoteStats(toUTCString(monthStart()));
			expect(stats.monthly).toBe(0);
			expect(stats.monthlyConverted).toBe(0);
			expect(stats.total).toBe(0);
		});
	});

	describe('filtros del listado', () => {
		it('statuses filtra por varios estados a la vez', async () => {
			await createQuote({ status: QuoteStatus.DRAFT });
			await createQuote({ status: QuoteStatus.CONVERTED });
			await createQuote({ status: QuoteStatus.CANCELLED });

			const rows = await getAllQuotes({ statuses: [QuoteStatus.DRAFT, QuoteStatus.CONVERTED] });
			expect(rows.map((r) => r.status).sort()).toEqual(
				[QuoteStatus.CONVERTED, QuoteStatus.DRAFT].sort()
			);
			expect(await countQuotes({ statuses: [QuoteStatus.DRAFT, QuoteStatus.CONVERTED] })).toBe(2);
		});

		it('las facetas ignoran el filtro de estados pero respetan el resto', async () => {
			const seller = await createUser({ fullName: 'Vendedor Facetas' });
			await createQuote({ sellerId: seller.id, status: QuoteStatus.DRAFT });
			await createQuote({ sellerId: seller.id, status: QuoteStatus.CANCELLED });
			await createQuote({ status: QuoteStatus.DRAFT });

			const counts = await countQuotesByStatus({
				sellerId: seller.id,
				statuses: [QuoteStatus.DRAFT]
			});
			expect(counts[QuoteStatus.DRAFT]).toBe(1);
			expect(counts[QuoteStatus.CANCELLED]).toBe(1);
		});

		it('ordena "vencen primero" y filtra por Cashea', async () => {
			await createQuote({ isCashea: true, validUntil: '2026-12-20', quoteDate: '2026-11-01' });
			await createQuote({ isCashea: false, validUntil: '2026-11-25', quoteDate: '2026-11-02' });
			await createQuote({ isCashea: true, validUntil: null, quoteDate: '2026-11-03' });

			const sorted = await getAllQuotes({ orderBy: 'validUntil', orderSort: 'asc' });
			expect(sorted[0].validUntil).toBe('2026-11-25');
			expect(sorted.at(-1)?.validUntil).toBeNull();

			const cashea = await getAllQuotes({ isCashea: true });
			expect(cashea).toHaveLength(2);
		});

		it('suma de selección y vendedores distintos', async () => {
			const seller = await createUser();
			await createQuote({ sellerId: seller.id, total: 100, status: QuoteStatus.DRAFT });
			await createQuote({ sellerId: seller.id, total: 50, status: QuoteStatus.DRAFT });

			expect(await sumQuotesForSelection()).toEqual({ count: 2, totalUsd: 150 });
			expect(await listQuoteSellers()).toEqual([{ id: seller.id, fullName: expect.any(String) }]);
			expect(await getQuoteNumberPreview()).toBeGreaterThanOrEqual(3);
		});
	});

	describe('markQuoteConverted', () => {
		it('devuelve null y no escribe nada si el presupuesto ya no es DRAFT', async () => {
			const quote = await createQuote({ status: QuoteStatus.CANCELLED });
			const result = await markQuoteConverted(quote.id, {
				conversionSaleId: crypto.randomUUID()
			});
			expect(result).toBeNull();
		});

		it('marca DRAFT con saleId y cliente en la misma escritura', async () => {
			const quote = await createQuote({ status: QuoteStatus.DRAFT, customerId: null });
			const customer = await createCustomer();
			const saleId = crypto.randomUUID();
			const result = await markQuoteConverted(quote.id, {
				conversionSaleId: saleId,
				customerId: customer.id
			});
			expect(result).toMatchObject({
				status: QuoteStatus.CONVERTED,
				conversionSaleId: saleId,
				customerId: customer.id
			});
		});
	});
});
