/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: sale reads.
 */
import type {
	GetSalesOptions,
	SaleFilterOptions,
	SaleOrderBy,
	SaleWithRelations,
	SalesStats
} from './types';
import { buildSaleConditions, saleSearchFields } from './shared';
import { eq, isNull, and, desc, asc, max, count, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { relevanceScoreOrderSql } from '$lib/server/db/search';
import type { DbOrTx } from '$lib/server/db/types';

import { sales, customers, users, type Sale } from '$lib/server/db/schema';
import type { AnyColumn } from 'drizzle-orm';

/** Column map for orderBy (saleDate is an alias of createdAt — single date truth) */
const ORDER_COLUMNS: Record<SaleOrderBy, AnyColumn> = {
	saleDate: sales.createdAt,
	orderNumber: sales.orderNumber,
	total: sales.total,
	createdAt: sales.createdAt
};

// ============================================================================
// SALES
// ============================================================================

/**
 * Get the next order number (MAX + 1).
 * When called inside a transaction, ensures sequential numbering without gaps.
 */
export async function getNextOrderNumber(executor: DbOrTx = db): Promise<number> {
	const [row] = await executor.select({ maxNum: max(sales.orderNumber) }).from(sales);
	return (row?.maxNum ?? 0) + 1;
}

/**
 * Get all sales with customer and seller info.
 *
 * @example
 * getAllSales()                                                 // non-deleted, newest first
 * getAllSales({ status: 'COMPLETED', limit: 10 })               // filtered + paginated
 * getAllSales({ customerId: '...', dateFrom: new Date() })      // by customer + date
 * getAllSales({ search: 'john', orderBy: 'total', orderSort: 'asc' })
 */
export async function getAllSales(options?: GetSalesOptions): Promise<SaleWithRelations[]> {
	const opts = options ?? {};
	const where = buildSaleConditions(opts);

	// Default: newest first (by order number)
	const orderFn = opts.orderSort === 'asc' ? asc : desc;
	const orderCol = opts.orderBy ? ORDER_COLUMNS[opts.orderBy] : sales.orderNumber;

	const base = db
		.select({
			sale: sales,
			customer: {
				id: customers.id,
				firstName: customers.firstName,
				lastName: customers.lastName,
				idNumber: customers.idNumber,
				primaryPhone: customers.primaryPhone
			},
			seller: { id: users.id, fullName: users.fullName }
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.$dynamic();

	if (where) base.where(where);
	const orderByColumns: SQL[] = [];
	if (opts.search) {
		orderByColumns.push(relevanceScoreOrderSql(opts.search.trim(), saleSearchFields()));
	}
	orderByColumns.push(orderFn(orderCol));
	if (orderByColumns.length > 0) base.orderBy(...orderByColumns);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	const results = await base;

	return results.map((r) => ({
		...r.sale,
		/** Alias sourced from createdAt (single date truth) */
		saleDate: r.sale.createdAt,
		customer: r.customer?.id ? r.customer : null,
		seller: r.seller?.id ? r.seller : null,
		cancelledBy: null,
		refundedBy: null
	}));
}

/**
 * Count sales matching the given filters.
 * Uses the same conditions as getAllSales.
 */
export async function countSales(options?: SaleFilterOptions): Promise<number> {
	const where = buildSaleConditions(options ?? {});

	// JOINs needed because search references customer/seller columns
	const base = db
		.select({ value: count() })
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.$dynamic();

	if (where) base.where(where);
	const [result] = await base;
	return result.value;
}

/**
 * Get aggregated sales stats in a single query using conditional counts.
 *
 * @param monthStartIso - ISO date string for the start of the current month
 */
export async function getSalesStats(monthStartIso: string): Promise<SalesStats> {
	const [row] = await db
		.select({
			monthly: sql<number>`count(*) filter (where ${sales.createdAt} >= ${monthStartIso})`.mapWith(
				Number
			),
			pending: sql<number>`count(*) filter (where ${sales.status} = 'PENDING')`.mapWith(Number),
			completed: sql<number>`count(*) filter (where ${sales.status} = 'COMPLETED')`.mapWith(Number),
			cancelled: sql<number>`count(*) filter (where ${sales.status} = 'CANCELLED')`.mapWith(Number)
		})
		.from(sales)
		.where(isNull(sales.deletedAt));

	return row;
}

/**
 * Find a sale by ID
 * @param deleted - If true, also matches soft-deleted sales (default: false)
 */
export async function findSaleById(
	id: string,
	{ deleted }: { deleted?: boolean } = {},
	executor: DbOrTx = db
): Promise<Sale | null> {
	const filter = deleted ? eq(sales.id, id) : and(eq(sales.id, id), isNull(sales.deletedAt));
	const [sale] = await executor.select().from(sales).where(filter!);
	return sale ?? null;
}

/**
 * Find a single sale by ID with customer/seller relations
 * @param deleted - If true, also matches soft-deleted sales (default: false)
 */
export async function findSaleByIdWithRelations(
	id: string,
	{ deleted }: { deleted?: boolean } = {}
): Promise<SaleWithRelations | null> {
	const filter = deleted ? eq(sales.id, id) : and(eq(sales.id, id), isNull(sales.deletedAt));
	const cancelledByUser = alias(users, 'cancelled_by_user');
	const refundedByUser = alias(users, 'refunded_by_user');

	const [result] = await db
		.select({
			sale: sales,
			customer: {
				id: customers.id,
				firstName: customers.firstName,
				lastName: customers.lastName,
				idNumber: customers.idNumber,
				primaryPhone: customers.primaryPhone
			},
			seller: { id: users.id, fullName: users.fullName },
			cancelledBy: { id: cancelledByUser.id, fullName: cancelledByUser.fullName },
			refundedBy: { id: refundedByUser.id, fullName: refundedByUser.fullName }
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.leftJoin(cancelledByUser, eq(sales.cancelledById, cancelledByUser.id))
		.leftJoin(refundedByUser, eq(sales.refundedById, refundedByUser.id))
		.where(filter!);

	if (!result) return null;

	return {
		...result.sale,
		/** Alias sourced from createdAt (single date truth) */
		saleDate: result.sale.createdAt,
		customer: result.customer?.id ? result.customer : null,
		seller: result.seller?.id ? result.seller : null,
		cancelledBy: result.cancelledBy?.id ? result.cancelledBy : null,
		refundedBy: result.refundedBy?.id ? result.refundedBy : null
	};
}
