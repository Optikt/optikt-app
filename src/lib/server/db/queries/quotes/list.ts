import { asc, count, desc, eq, isNull, max, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { relevanceScoreOrderSql } from '$lib/server/db/search';
import { customers, quotes, sales, users } from '$lib/server/db/schema';
import { QuoteStatus } from '$lib/shared/contracts/quotes';
import { buildQuoteConditions, quoteListBase, quoteSearchFields } from './shared';
import type { GetQuotesOptions, QuoteFilterOptions, QuoteOrderBy, QuoteStats } from './types';

const ORDER_COLUMNS: Record<QuoteOrderBy, AnyColumn> = {
	quoteDate: quotes.quoteDate,
	quoteNumber: quotes.quoteNumber,
	total: quotes.total,
	createdAt: quotes.createdAt,
	// "Vencen primero" se ordena en su propia rama (ver getAllQuotes).
	validUntil: quotes.validUntil
};

/**
 * Get all quotes with customer, seller and generated-sale number.
 */
export async function getAllQuotes(options?: GetQuotesOptions) {
	const opts = options ?? {};
	const where = buildQuoteConditions(opts);
	const orderFn = opts.orderSort === 'asc' ? asc : desc;
	const orderCol = opts.orderBy ? ORDER_COLUMNS[opts.orderBy] : quotes.quoteDate;

	const base = quoteListBase();
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

/** Count quotes matching the given filters. */
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
	const { status: _status, statuses: _statuses, ...rest } = options ?? {};
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
 * KPIs globales (no reaccionan a filtros), mismo criterio que `getSalesStats`.
 * Tasa de conversión = convertidos del MES / creados del MES (misma cohorte por
 * `quoteDate`, así el numerador nunca supera al denominador).
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
				sql<number>`count(*) filter (where ${quotes.quoteDate} >= ${monthStartIso} and ${quotes.status} = 'CONVERTED')`.mapWith(
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
 * Preview NO reservante del próximo número (MAX + 1), solo para el wizard.
 * El número real lo asigna la sequence al insertar y puede diferir.
 */
export async function getQuoteNumberPreview(): Promise<number> {
	const [row] = await db.select({ maxNum: max(quotes.quoteNumber) }).from(quotes);
	return (row?.maxNum ?? 0) + 1;
}

/** Suma de totales de los presupuestos que cumplen los filtros (pie del listado). */
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

/** Vendedores distintos que aparecen en presupuestos no borrados (filtro). */
export async function listQuoteSellers(): Promise<{ id: string; fullName: string }[]> {
	return db
		.selectDistinct({ id: users.id, fullName: users.fullName })
		.from(users)
		.innerJoin(quotes, eq(quotes.sellerId, users.id))
		.where(isNull(quotes.deletedAt))
		.orderBy(users.fullName);
}
