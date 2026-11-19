import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '$lib/testing/integration/db';
import {
	createCustomer,
	createMaterial,
	createProduct,
	createQuote,
	createSale,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { callRemote } from '$lib/testing/remoteHarness';
import { findQuoteByIdWithRelations } from './reads';
import { countQuotes, getAllQuotes } from './list';
import { getQuoteConversionPreview } from './conversion';
import { findConvertedSaleSummaryById } from '$lib/server/db/queries/sales/reads';
import { createNewQuoteCore } from '$lib/server/quotes/createNewQuote';
import {
	getQuoteConversionPreview as getQuoteConversionPreviewRemote,
	getQuoteFacets,
	getQuoteStats,
	listQuotes
} from '$lib/remote/quotes/queries.remote';
import type { PaginatedQuotes, QuoteFacets } from '$lib/remote/quotes/queries.remote';
import type { QuoteStats } from '$lib/server/db/queries/quotes/types';
import type { QuoteConversionPreview } from '$lib/shared/quotes/conversionPreview';
import { DiscountType, UserRole } from '$lib/shared/enums';
import { FreeItemCategory, SaleItemType } from '$lib/shared/enums/lensTypes';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.SELLER, ipAddress: '127.0.0.1', userAgent: null };
}

async function seedQuoteWithProduct(opts: { stock: number; customerId?: string } = { stock: 10 }) {
	const seller = await createUser();
	const supplier = await createSupplier();
	const material = await createMaterial();
	const product = await createProduct({
		supplierId: supplier.id,
		materialId: material.id,
		stock: opts.stock
	});
	const created = await createNewQuoteCore(
		{
			quoteDate: '2026-11-10',
			discount: 0,
			discountType: DiscountType.FIXED,
			snapshotTaxRate: 16,
			isCashea: false,
			customerId: opts.customerId,
			items: [
				{
					itemType: SaleItemType.PRODUCT,
					productId: product.id,
					quantity: 2,
					unitPrice: 20,
					discount: 0,
					discountType: DiscountType.FIXED
				},
				{
					itemType: SaleItemType.FREE_ITEM,
					quantity: 1,
					unitPrice: 15,
					discount: 0,
					discountType: DiscountType.FIXED,
					freeItemCategory: FreeItemCategory.OTHER,
					freeItemDescription: 'Estuche rígido'
				}
			]
		},
		ctx(seller.id)
	);
	if (!created.success) throw new Error('quote was not created');
	return { quote: created.quote, product, seller };
}

/** Lecturas de quotes que el listado y el detalle usan (Sonar: cobertura de código nuevo). */
describe('lecturas de presupuestos', () => {
	beforeEach(async () => {
		await resetDb();
	});

	describe('findQuoteByIdWithRelations', () => {
		it('trae cliente, vendedor y número de la venta convertida', async () => {
			const customer = await createCustomer();
			const seller = await createUser({ fullName: 'Ana Pérez' });
			const sale = await createSale({ orderNumber: 4242 });
			const quote = await createQuote({
				customerId: customer.id,
				sellerId: seller.id,
				status: QuoteStatus.CONVERTED,
				conversionSaleId: sale.id
			});

			const found = await findQuoteByIdWithRelations(quote.id);
			expect(found?.customer?.id).toBe(customer.id);
			expect(found?.seller?.fullName).toBe('Ana Pérez');
			expect(found?.convertedOrderNumber).toBe(4242);
		});

		it('sin cliente ni venta → null en las relaciones; id desconocido → null', async () => {
			const quote = await createQuote({ customerId: null });
			const found = await findQuoteByIdWithRelations(quote.id);
			expect(found?.customer).toBeNull();
			expect(found?.convertedOrderNumber).toBeNull();
			expect(await findQuoteByIdWithRelations(crypto.randomUUID())).toBeNull();
		});

		it('borrado lógico: oculto salvo con { deleted: true }', async () => {
			const quote = await createQuote({ deletedAt: new Date().toISOString() });
			expect(await findQuoteByIdWithRelations(quote.id)).toBeNull();
			expect((await findQuoteByIdWithRelations(quote.id, { deleted: true }))?.id).toBe(quote.id);
		});
	});

	describe('filtros (buildQuoteConditions)', () => {
		it('estado simple, cliente, rango de fechas, búsqueda e incluidos borrados', async () => {
			const customer = await createCustomer({ firstName: 'Oslavio', lastName: 'Moscatini' });
			await createQuote({
				customerId: customer.id,
				status: QuoteStatus.DRAFT,
				quoteDate: '2026-11-05T12:00:00.000Z'
			});
			await createQuote({ status: QuoteStatus.CANCELLED, quoteDate: '2026-10-01T12:00:00.000Z' });
			await createQuote({
				status: QuoteStatus.DRAFT,
				quoteDate: '2026-11-06T12:00:00.000Z',
				deletedAt: new Date().toISOString()
			});

			expect(await countQuotes({ status: QuoteStatus.CANCELLED })).toBe(1);
			expect(await countQuotes({ customerId: customer.id })).toBe(1);
			expect(await countQuotes({ dateFrom: '2026-11-01', dateTo: '2026-11-30' })).toBe(1);
			expect(await countQuotes({ includeDeleted: true })).toBe(3);

			const found = await getAllQuotes({ search: 'moscatini' });
			expect(found).toHaveLength(1);
			expect(found[0].customer?.id).toBe(customer.id);
		});
	});

	describe('getQuoteConversionPreview', () => {
		it('clasifica producto con stock e ítem libre sin seguimiento', async () => {
			const customer = await createCustomer();
			const { quote } = await seedQuoteWithProduct({ stock: 10, customerId: customer.id });

			const preview = await getQuoteConversionPreview(quote.id);
			expect(preview?.items).toHaveLength(2);
			expect(preview?.summary.missingCustomer).toBe(false);
			const kinds = preview?.items.map((i) => i.stock.kind).sort();
			expect(kinds).toEqual(['ok', 'untracked']);
		});

		it('stock insuficiente y sin cliente; id desconocido → null', async () => {
			const { quote } = await seedQuoteWithProduct({ stock: 1 });
			const preview = await getQuoteConversionPreview(quote.id);
			expect(preview?.summary.allStockOk).toBe(false);
			expect(preview?.summary.missingCustomer).toBe(true);
			expect(await getQuoteConversionPreview(crypto.randomUUID())).toBeNull();
		});
	});

	describe('findConvertedSaleSummaryById', () => {
		it('resumen mínimo de la venta o null', async () => {
			const sale = await createSale({ orderNumber: 77 });
			const summary = await findConvertedSaleSummaryById(sale.id);
			expect(summary?.orderNumber).toBe(77);
			expect(await findConvertedSaleSummaryById(crypto.randomUUID())).toBeNull();
		});
	});

	describe('remotes de lectura (queries.remote)', () => {
		it('rechazan sin sesión (401)', async () => {
			await expect(callRemote(getQuoteStats, {}, { user: null })).rejects.toMatchObject({
				status: 401
			});
			await expect(
				callRemote(listQuotes, { page: 1, perPage: 10 }, { user: null })
			).rejects.toMatchObject({ status: 401 });
		});

		it('listQuotes, getQuoteFacets, getQuoteStats y preview con sesión', async () => {
			const admin = await createUser({ role: UserRole.ADMIN });
			const user = { id: admin.id, role: UserRole.ADMIN };
			const { quote } = await seedQuoteWithProduct();
			// Número explícito: el core usa la sequence y la factory su contador (no chocan).
			await createQuote({
				quoteNumber: 9001,
				status: QuoteStatus.CANCELLED,
				isCashea: true,
				total: 50
			});

			for (const sort of ['recent', 'total', 'expiring'] as const) {
				const page = (await callRemote(
					listQuotes,
					{ page: 1, perPage: 10, sort },
					{ user }
				)) as PaginatedQuotes;
				expect(page.total).toBe(2);
				expect(page.totalPages).toBe(1);
			}

			const cashea = (await callRemote(
				listQuotes,
				{ page: 1, perPage: 10, isCashea: true, statuses: [QuoteStatus.CANCELLED] },
				{ user }
			)) as PaginatedQuotes;
			expect(cashea.total).toBe(1);

			const facets = (await callRemote(
				getQuoteFacets,
				{ page: 1, perPage: 1 },
				{ user }
			)) as QuoteFacets;
			expect(facets.counts[QuoteStatus.DRAFT]).toBe(1);
			expect(facets.counts[QuoteStatus.CANCELLED]).toBe(1);

			const stats = (await callRemote(getQuoteStats, {}, { user })) as QuoteStats;
			expect(stats.total).toBe(2);

			const preview = (await callRemote(
				getQuoteConversionPreviewRemote,
				{ id: quote.id },
				{ user }
			)) as QuoteConversionPreview | null;
			expect(preview?.items.length).toBe(2);
		});
	});
});
