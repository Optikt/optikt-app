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
	type SQL
} from 'drizzle-orm';
import { db } from '$lib/server/db';
import { buildTokenSearchConditions } from '$lib/server/db/search';
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
	type Quote,
	type NewQuote,
	type QuoteItem,
	type NewQuoteItem,
	type QuoteItemFreeDetails
} from '$lib/server/db/schema';

// ============================================================================
// TYPES
// ============================================================================

export type QuoteWithRelations = Quote & {
	customer: { id: string; firstName: string; lastName: string; idNumber: string | null } | null;
	seller: { id: string; fullName: string } | null;
};

export type QuoteItemWithDetails = QuoteItem & {
	product: { id: string; name: string; sku: string } | null;
	lensCatalogItem: { id: string; name: string; type: string } | null;
	supplierTreatment: { id: string; name: string; category: string } | null;
	freeDetails: QuoteItemFreeDetails | null;
};

export interface QuoteStats {
	monthly: number;
	draft: number;
	converted: number;
	cancelled: number;
}

// ============================================================================
// QUERY OPTIONS
// ============================================================================

export type QuoteOrderBy = 'quoteDate' | 'quoteNumber' | 'total' | 'createdAt';

export interface QuoteFilterOptions {
	includeDeleted?: boolean;
	status?: string;
	customerId?: string;
	sellerId?: string;
	dateFrom?: string;
	dateTo?: string;
	search?: string;
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

const ORDER_COLUMNS: Record<QuoteOrderBy, AnyColumn> = {
	quoteDate: quotes.quoteDate,
	quoteNumber: quotes.quoteNumber,
	total: quotes.total,
	createdAt: quotes.createdAt
};

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

	if (opts.dateFrom) {
		conditions.push(gte(quotes.quoteDate, opts.dateFrom));
	}

	if (opts.dateTo) {
		conditions.push(lte(quotes.quoteDate, toUTCString(toEndOfDay(fromISODate(opts.dateTo)!))));
	}

	if (opts.search) {
		const concatFields = sql`concat(coalesce(${customers.firstName}, ''), ' ', coalesce(${customers.lastName}, ''), ' ', coalesce(${customers.idNumber}, ''), ' ', coalesce(${users.fullName}, ''))`;
		conditions.push(...buildTokenSearchConditions(opts.search, concatFields));
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

// ============================================================================
// QUOTES
// ============================================================================

/**
 * Get the next quote number (MAX + 1).
 */
export async function getNextQuoteNumber(executor: DbOrTx = db): Promise<number> {
	const [row] = await executor.select({ maxNum: max(quotes.quoteNumber) }).from(quotes);
	return (row?.maxNum ?? 0) + 1;
}

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
			seller: { id: users.id, fullName: users.fullName }
		})
		.from(quotes)
		.leftJoin(customers, eq(quotes.customerId, customers.id))
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.$dynamic();

	if (where) base.where(where);
	base.orderBy(orderFn(orderCol));
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	const results = await base;

	return results.map((r) => ({
		...r.quote,
		customer: r.customer?.id ? r.customer : null,
		seller: r.seller?.id ? r.seller : null
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
		.$dynamic();

	if (where) base.where(where);
	const [result] = await base;
	return result.value;
}

/**
 * Get aggregated quote stats in a single query using conditional counts.
 */
export async function getQuoteStats(monthStartIso: string): Promise<QuoteStats> {
	const [row] = await db
		.select({
			monthly: sql<number>`count(*) filter (where ${quotes.quoteDate} >= ${monthStartIso})`.mapWith(
				Number
			),
			draft: sql<number>`count(*) filter (where ${quotes.status} = 'DRAFT')`.mapWith(Number),
			converted: sql<number>`count(*) filter (where ${quotes.status} = 'CONVERTED')`.mapWith(
				Number
			),
			cancelled: sql<number>`count(*) filter (where ${quotes.status} = 'CANCELLED')`.mapWith(Number)
		})
		.from(quotes)
		.where(isNull(quotes.deletedAt));

	return row;
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
			seller: { id: users.id, fullName: users.fullName }
		})
		.from(quotes)
		.leftJoin(customers, eq(quotes.customerId, customers.id))
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.where(filter!);

	if (!result) return null;

	return {
		...result.quote,
		customer: result.customer?.id ? result.customer : null,
		seller: result.seller?.id ? result.seller : null
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
