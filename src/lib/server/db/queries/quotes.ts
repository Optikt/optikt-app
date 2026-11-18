import {
	eq,
	isNull,
	and,
	desc,
	asc,
	gte,
	lte,
	max,
	count,
	sql,
	type AnyColumn,
	type SQL,
	type SQLWrapper
} from 'drizzle-orm';
import { db } from '$lib/server/db';
import { buildTokenSearchConditions, relevanceScoreOrderSql } from '$lib/server/db/search';
import type { DbOrTx } from '$lib/server/db/types';
import { fromISODate, nowISO, toEndOfDay, toUTCString } from '$lib/dates';
import {
	quotes,
	quoteItems,
	quoteItemFreeDetails,
	customers,
	users,
	products,
	lensCatalogItems,
	supplierTreatments,
	sales,
	type Quote,
	type NewQuote,
	type QuoteItem,
	type NewQuoteItem,
	type QuoteItemFreeDetails
} from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import {
	buildQuoteConversionPreview,
	type QuoteConversionPreview,
	type QuoteConversionItemRow,
	type ConversionCatalogEntry
} from '$lib/server/quotes/conversionPreviewLogic';

// ============================================================================
// TYPES
// ============================================================================

export type QuoteWithRelations = Quote & {
	customer: { id: string; firstName: string; lastName: string; idNumber: string | null } | null;
	seller: { id: string; fullName: string } | null;
	/** Número de la venta generada (para "Venta #0298" en la lista y el detalle). */
	convertedOrderNumber: number | null;
};

export type QuoteItemWithDetails = QuoteItem & {
	product: { id: string; name: string; sku: string } | null;
	lensCatalogItem: { id: string; name: string; type: string } | null;
	supplierTreatment: { id: string; name: string; category: string } | null;
	freeDetails: QuoteItemFreeDetails | null;
};

/**
 * KPIs del listado (globales, como ventas). Fórmulas documentadas en
 * `docs/agents/quotes.md`:
 * - `open/openTotal`: DRAFT activos (card "Abiertos").
 * - `monthly/monthlyTotal`: creados desde el inicio de mes (quoteDate).
 * - `monthlyConverted`: convertidos desde el inicio de mes (venta generada
 *   con createdAt ≥ inicio de mes). Tasa = monthlyConverted / monthly.
 */
export interface QuoteStats {
	total: number;
	open: number;
	openTotal: number;
	monthly: number;
	monthlyTotal: number;
	monthlyConverted: number;
	draft: number;
	converted: number;
	cancelled: number;
}

// ============================================================================
// QUERY OPTIONS
// ============================================================================

export type QuoteOrderBy = 'quoteDate' | 'quoteNumber' | 'total' | 'createdAt' | 'validUntil';

export interface QuoteFilterOptions {
	includeDeleted?: boolean;
	status?: string;
	customerId?: string;
	sellerId?: string;
	dateFrom?: string;
	dateTo?: string;
	search?: string;
	isCashea?: boolean;
}

export interface GetQuotesOptions extends QuoteFilterOptions {
	orderBy?: QuoteOrderBy;
	orderSort?: 'asc' | 'desc';
	limit?: number;
	offset?: number;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

const ORDER_COLUMNS: Record<QuoteOrderBy, AnyColumn | SQL> = {
	quoteDate: quotes.quoteDate,
	quoteNumber: quotes.quoteNumber,
	total: quotes.total,
	createdAt: quotes.createdAt,
	/** "Vencen primero": fecha válida más cercana arriba, sin vencimiento al final. */
	validUntil: sql`CASE WHEN ${quotes.validUntil} IS NULL THEN 1 ELSE 0 END`
};

function quoteSearchConcat(): SQL {
	return sql`concat(coalesce(${customers.firstName}, ''), ' ', coalesce(${customers.lastName}, ''), ' ', coalesce(${customers.idNumber}, ''), ' ', coalesce(${users.fullName}, ''))`;
}

function quoteSearchFields(): SQLWrapper[] {
	return [customers.firstName, customers.lastName, customers.idNumber, users.fullName];
}

function buildQuoteConditions(opts: QuoteFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (!opts.includeDeleted) {
		conditions.push(isNull(quotes.deletedAt));
	}

	if (opts.status) {
		conditions.push(eq(quotes.status, opts.status));
	}

	if (opts.customerId) {
		conditions.push(eq(quotes.customerId, opts.customerId));
	}

	if (opts.sellerId) {
		conditions.push(eq(quotes.sellerId, opts.sellerId));
	}

	if (opts.isCashea !== undefined) {
		conditions.push(eq(quotes.isCashea, opts.isCashea));
	}

	if (opts.dateFrom) {
		conditions.push(gte(quotes.quoteDate, opts.dateFrom));
	}

	if (opts.dateTo) {
		conditions.push(lte(quotes.quoteDate, toUTCString(toEndOfDay(fromISODate(opts.dateTo)!))));
	}

	if (opts.search) {
		conditions.push(...buildTokenSearchConditions(opts.search, quoteSearchConcat()));
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

// ============================================================================
// QUOTES
// ============================================================================

/**
 * Get all quotes with customer and seller info.
 */
export async function getAllQuotes(options?: GetQuotesOptions): Promise<QuoteWithRelations[]> {
	const opts = options ?? {};
	const where = buildQuoteConditions(opts);

	const orderFn = opts.orderSort === 'asc' ? asc : desc;
	const orderCol = opts.orderBy ? ORDER_COLUMNS[opts.orderBy] : quotes.quoteDate;

	const base = db
		.select({
			quote: quotes,
			customer: {
				id: customers.id,
				firstName: customers.firstName,
				lastName: customers.lastName,
				idNumber: customers.idNumber
			},
			seller: { id: users.id, fullName: users.fullName },
			convertedOrderNumber: sales.orderNumber
		})
		.from(quotes)
		.leftJoin(customers, eq(quotes.customerId, customers.id))
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.leftJoin(sales, eq(quotes.conversionSaleId, sales.id))
		.$dynamic();

	if (where) base.where(where);
	const orderByColumns: SQL[] = [];
	if (opts.search) {
		orderByColumns.push(relevanceScoreOrderSql(opts.search.trim(), quoteSearchFields()));
	}
	if (opts.orderBy === 'validUntil') {
		// "Vencen primero": con fecha (asc) antes que sin fecha; desempate por fecha más antigua.
		orderByColumns.push(asc(sql`CASE WHEN ${quotes.validUntil} IS NULL THEN 1 ELSE 0 END`));
		orderByColumns.push(asc(quotes.validUntil));
		orderByColumns.push(desc(quotes.quoteNumber));
	} else {
		orderByColumns.push(orderFn(orderCol));
	}
	if (orderByColumns.length > 0) base.orderBy(...orderByColumns);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	const results = await base;

	return results.map((r) => ({
		...r.quote,
		customer: r.customer?.id ? r.customer : null,
		seller: r.seller?.id ? r.seller : null,
		convertedOrderNumber: r.convertedOrderNumber ?? null
	}));
}

/**
 * Count quotes matching the given filters.
 */
export async function countQuotes(options?: QuoteFilterOptions): Promise<number> {
	const where = buildQuoteConditions(options ?? {});

	const base = db
		.select({ value: count() })
		.from(quotes)
		.leftJoin(customers, eq(quotes.customerId, customers.id))
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.leftJoin(sales, eq(quotes.conversionSaleId, sales.id))
		.$dynamic();

	if (where) base.where(where);
	const [result] = await base;
	return result.value;
}

/**
 * Conteo por estado respetando todos los filtros excepto el de estado
 * (pestañas facetadas del listado, mismo patrón que ventas).
 */
export async function countQuotesByStatus(
	options?: QuoteFilterOptions
): Promise<Record<QuoteStatus, number>> {
	const { status: _ignored, ...rest } = options ?? {};
	const where = buildQuoteConditions(rest);

	const base = db
		.select({ status: quotes.status, value: count() })
		.from(quotes)
		.leftJoin(customers, eq(quotes.customerId, customers.id))
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.leftJoin(sales, eq(quotes.conversionSaleId, sales.id))
		.$dynamic();

	if (where) base.where(where);
	const rows = await base.groupBy(quotes.status);

	const counts: Record<QuoteStatus, number> = {
		[QuoteStatus.DRAFT]: 0,
		[QuoteStatus.CONVERTED]: 0,
		[QuoteStatus.EXPIRED]: 0,
		[QuoteStatus.CANCELLED]: 0
	};
	for (const row of rows) {
		counts[row.status as QuoteStatus] = row.value;
	}
	return counts;
}

/**
 * Get aggregated quote stats in a single query using conditional counts/sums.
 * Alcance global (no reacciona a filtros), mismo criterio que `getSalesStats`.
 */
export async function getQuoteStats(monthStartIso: string): Promise<QuoteStats> {
	const [row] = await db
		.select({
			total: count(),
			open: sql<number>`count(*) filter (where ${quotes.status} = 'DRAFT')`.mapWith(Number),
			openTotal:
				sql<number>`coalesce(sum(${quotes.total}) filter (where ${quotes.status} = 'DRAFT'), 0)`.mapWith(
					Number
				),
			monthly: sql<number>`count(*) filter (where ${quotes.quoteDate} >= ${monthStartIso})`.mapWith(
				Number
			),
			monthlyTotal:
				sql<number>`coalesce(sum(${quotes.total}) filter (where ${quotes.quoteDate} >= ${monthStartIso} and ${quotes.status} != 'CANCELLED'), 0)`.mapWith(
					Number
				),
			monthlyConverted:
				sql<number>`count(*) filter (where ${quotes.status} = 'CONVERTED' and ${sales.createdAt} >= ${monthStartIso})`.mapWith(
					Number
				),
			draft: sql<number>`count(*) filter (where ${quotes.status} = 'DRAFT')`.mapWith(Number),
			converted: sql<number>`count(*) filter (where ${quotes.status} = 'CONVERTED')`.mapWith(
				Number
			),
			cancelled: sql<number>`count(*) filter (where ${quotes.status} = 'CANCELLED')`.mapWith(Number)
		})
		.from(quotes)
		.leftJoin(sales, eq(quotes.conversionSaleId, sales.id))
		.where(isNull(quotes.deletedAt));

	return row;
}

/**
 * Preview NO reservante del próximo número de presupuesto (MAX + 1), solo para
 * mostrar en el wizard antes de guardar — el número real lo asigna la sequence
 * al insertar y puede diferir si hay creaciones concurrentes.
 */
export async function getQuoteNumberPreview(): Promise<number> {
	const [row] = await db.select({ maxNum: max(quotes.quoteNumber) }).from(quotes);
	return (row?.maxNum ?? 0) + 1;
}

/**
 * Marca un presupuesto como convertido CON guard de concurrencia:
 * `UPDATE ... WHERE id = ? AND status = 'DRAFT' RETURNING *`. Devuelve null si
 * el presupuesto ya no estaba en DRAFT (doble conversión simultánea ⇒ la
 * segunda llamada obtiene 0 filas y la tx del caller hace rollback).
 */
export async function markQuoteConverted(
	id: string,
	{ conversionSaleId, customerId }: { conversionSaleId: string; customerId?: string },
	executor: DbOrTx = db
): Promise<Quote | null> {
	const [quote] = await executor
		.update(quotes)
		.set({
			status: QuoteStatus.CONVERTED,
			conversionSaleId,
			...(customerId ? { customerId } : {}),
			updatedAt: nowISO()
		})
		.where(and(eq(quotes.id, id), eq(quotes.status, QuoteStatus.DRAFT)))
		.returning();
	return quote ?? null;
}

/**
 * Suma de totales de los presupuestos que cumplen los filtros (pie del listado).
 */
export async function sumQuotesForSelection(
	options?: QuoteFilterOptions
): Promise<{ count: number; totalUsd: number }> {
	const where = buildQuoteConditions(options ?? {});

	const base = db
		.select({
			count: count(),
			totalUsd: sql<number>`coalesce(sum(${quotes.total}), 0)`.mapWith(Number)
		})
		.from(quotes)
		.leftJoin(customers, eq(quotes.customerId, customers.id))
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.leftJoin(sales, eq(quotes.conversionSaleId, sales.id))
		.$dynamic();

	if (where) base.where(where);
	const [row] = await base;

	return { count: row?.count ?? 0, totalUsd: row?.totalUsd ?? 0 };
}

// ============================================================================
// PREVIEW DE CONVERSIÓN (hero "Si se convierte hoy" + modal "Revisión")
// ============================================================================

/**
 * Preview de conversión: stock y precio vigente por ítem + resumen.
 * Misma fuente para el hero del detalle y el modal de conversión.
 */
export async function getQuoteConversionPreview(
	quoteId: string
): Promise<QuoteConversionPreview | null> {
	const quote = await findQuoteById(quoteId);
	if (!quote) return null;

	const rows = await db
		.select({
			item: quoteItems,
			product: {
				id: products.id,
				name: products.name,
				currentSalePrice: products.currentSalePrice,
				stock: products.stock
			},
			lens: {
				id: lensCatalogItems.id,
				name: lensCatalogItems.name,
				salePrice: lensCatalogItems.salePrice,
				pairPurchasePrice: lensCatalogItems.pairPurchasePrice,
				mountingPrice: lensCatalogItems.mountingPrice,
				shippingPrice: lensCatalogItems.shippingPrice,
				stock: lensCatalogItems.stock,
				inventoryMode: lensCatalogItems.inventoryMode
			},
			treatment: {
				id: supplierTreatments.id,
				name: supplierTreatments.name,
				price: supplierTreatments.price
			}
		})
		.from(quoteItems)
		.leftJoin(products, eq(quoteItems.productId, products.id))
		.leftJoin(lensCatalogItems, eq(quoteItems.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(supplierTreatments, eq(quoteItems.supplierTreatmentId, supplierTreatments.id))
		.where(and(eq(quoteItems.quoteId, quoteId), isNull(quoteItems.deletedAt)));

	const itemRows: QuoteConversionItemRow[] = rows.map((r) => ({
		item: r.item,
		label:
			r.item.snapshotName ??
			r.product?.name ??
			r.lens?.name ??
			r.treatment?.name ??
			'Ítem del presupuesto',
		product: r.product?.id
			? { currentSalePrice: r.product.currentSalePrice, stock: r.product.stock }
			: null,
		lens: r.lens?.id
			? {
					// El catálogo de lentes vende con `salePrice` (fallback = costo par);
					// el clasificador lo lee como `currentSalePrice`.
					currentSalePrice: r.lens.salePrice,
					pairPurchasePrice: r.lens.pairPurchasePrice,
					mountingPrice: r.lens.mountingPrice,
					shippingPrice: r.lens.shippingPrice,
					stock: r.lens.stock,
					inventoryMode: r.lens.inventoryMode
				}
			: null,
		treatment: r.treatment?.id
			? ({ currentSalePrice: r.treatment.price } satisfies ConversionCatalogEntry)
			: null
	}));

	return buildQuoteConversionPreview(itemRows, { hasCustomer: quote.customerId !== null });
}

/**
 * Find a quote by ID
 */
export async function findQuoteById(
	id: string,
	{ deleted }: { deleted?: boolean } = {},
	executor: DbOrTx = db
): Promise<Quote | null> {
	const filter = deleted ? eq(quotes.id, id) : and(eq(quotes.id, id), isNull(quotes.deletedAt));
	const [quote] = await executor.select().from(quotes).where(filter!);
	return quote ?? null;
}

/**
 * Find a single quote by ID with customer/seller relations
 */
export async function findQuoteByIdWithRelations(
	id: string,
	{ deleted }: { deleted?: boolean } = {}
): Promise<QuoteWithRelations | null> {
	const filter = deleted ? eq(quotes.id, id) : and(eq(quotes.id, id), isNull(quotes.deletedAt));

	const [result] = await db
		.select({
			quote: quotes,
			customer: {
				id: customers.id,
				firstName: customers.firstName,
				lastName: customers.lastName,
				idNumber: customers.idNumber
			},
			seller: { id: users.id, fullName: users.fullName },
			convertedOrderNumber: sales.orderNumber
		})
		.from(quotes)
		.leftJoin(customers, eq(quotes.customerId, customers.id))
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.leftJoin(sales, eq(quotes.conversionSaleId, sales.id))
		.where(filter!);

	if (!result) return null;

	return {
		...result.quote,
		customer: result.customer?.id ? result.customer : null,
		seller: result.seller?.id ? result.seller : null,
		convertedOrderNumber: result.convertedOrderNumber ?? null
	};
}

/**
 * Create a new quote
 */
export async function createQuote(data: NewQuote, executor: DbOrTx = db): Promise<Quote> {
	const now = nowISO();
	const [quote] = await executor
		.insert(quotes)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return quote;
}

/**
 * Update a quote by ID
 */
export async function updateQuote(
	id: string,
	data: Partial<Omit<Quote, 'id' | 'createdAt'>>,
	executor: DbOrTx = db
): Promise<Quote | null> {
	const [quote] = await executor
		.update(quotes)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(quotes.id, id))
		.returning();
	return quote ?? null;
}

// ============================================================================
// QUOTE ITEMS
// ============================================================================

/**
 * Get quote items with product/lens/treatment details
 */
export async function getQuoteItemsWithDetails(quoteId: string): Promise<QuoteItemWithDetails[]> {
	const results = await db
		.select({
			item: quoteItems,
			product: { id: products.id, name: products.name, sku: products.sku },
			lensCatalogItem: {
				id: lensCatalogItems.id,
				name: lensCatalogItems.name,
				type: lensCatalogItems.type
			},
			supplierTreatment: {
				id: supplierTreatments.id,
				name: supplierTreatments.name,
				category: supplierTreatments.category
			},
			freeDetails: quoteItemFreeDetails
		})
		.from(quoteItems)
		.leftJoin(products, eq(quoteItems.productId, products.id))
		.leftJoin(lensCatalogItems, eq(quoteItems.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(supplierTreatments, eq(quoteItems.supplierTreatmentId, supplierTreatments.id))
		.leftJoin(quoteItemFreeDetails, eq(quoteItems.id, quoteItemFreeDetails.quoteItemId))
		.where(and(eq(quoteItems.quoteId, quoteId), isNull(quoteItems.deletedAt)));

	return results.map((r) => ({
		...r.item,
		product: r.product?.id ? r.product : null,
		lensCatalogItem: r.lensCatalogItem?.id ? r.lensCatalogItem : null,
		supplierTreatment: r.supplierTreatment?.id ? r.supplierTreatment : null,
		freeDetails: r.freeDetails?.id ? r.freeDetails : null
	}));
}

/**
 * Create multiple quote items
 */
export async function createQuoteItems(
	items: NewQuoteItem[],
	executor: DbOrTx = db
): Promise<QuoteItem[]> {
	const now = nowISO();
	return await executor
		.insert(quoteItems)
		.values(
			items.map((item) => ({
				...item,
				id: crypto.randomUUID(),
				createdAt: now,
				updatedAt: now
			}))
		)
		.returning();
}

/**
 * Delete all items for a quote (used when updating items)
 */
export async function deleteQuoteItems(quoteId: string, executor: DbOrTx = db): Promise<void> {
	await executor.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
}
