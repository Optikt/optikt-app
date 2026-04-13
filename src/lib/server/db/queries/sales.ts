import {
	eq,
	isNull,
	and,
	desc,
	asc,
	gte,
	lte,
	sum,
	max,
	ilike,
	or,
	count,
	sql,
	type AnyColumn,
	type SQL
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import { fromISODate, nowISO, toEndOfDay, toUTCString } from '$lib/dates';
import {
	sales,
	saleItems,
	salePayments,
	customers,
	users,
	products,
	lensCatalogItems,
	supplierTreatments,
	type Sale,
	type NewSale,
	type SaleItem,
	type NewSaleItem,
	type SalePayment,
	type NewSalePayment
} from '$lib/server/db/schema';

// ============================================================================
// TYPES
// ============================================================================

export type SaleWithRelations = Sale & {
	customer: { id: string; firstName: string; lastName: string; idNumber: string | null } | null;
	seller: { id: string; fullName: string } | null;
	cancelledBy: { id: string; fullName: string } | null;
	refundedBy: { id: string; fullName: string } | null;
};

export type SaleItemWithDetails = SaleItem & {
	product: { id: string; name: string; sku: string } | null;
	lensCatalogItem: { id: string; name: string; type: string } | null;
	supplierTreatment: { id: string; name: string; category: string } | null;
};

export interface SalesStats {
	monthly: number;
	pending: number;
	completed: number;
	cancelled: number;
}

// ============================================================================
// QUERY OPTIONS
// ============================================================================

/** Sortable sale columns */
export type SaleOrderBy = 'saleDate' | 'orderNumber' | 'total' | 'createdAt';

/** Options for filtering sales (shared between query and count) */
export interface SaleFilterOptions {
	/** Include soft-deleted sales in results (default: false) */
	includeDeleted?: boolean;
	/** Filter by sale status */
	status?: string;
	/** Filter by customer ID */
	customerId?: string;
	/** Filter by seller ID */
	sellerId?: string;
	/** Filter by date range start (ISO string) */
	dateFrom?: string;
	/** Filter by date range end (ISO string, inclusive — expanded to end of day) */
	dateTo?: string;
	/** Search by customer name, ID number, or seller name (case-insensitive) */
	search?: string;
}

/** Options for querying sales with relations */
export interface GetSalesOptions extends SaleFilterOptions {
	/** Column to order by (default: 'saleDate') */
	orderBy?: SaleOrderBy;
	/** Sort direction (default: 'desc') */
	orderSort?: 'asc' | 'desc';
	/** Maximum number of results to return */
	limit?: number;
	/** Number of results to skip (for pagination) */
	offset?: number;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/** Column map for orderBy */
const ORDER_COLUMNS: Record<SaleOrderBy, AnyColumn> = {
	saleDate: sales.saleDate,
	orderNumber: sales.orderNumber,
	total: sales.total,
	createdAt: sales.createdAt
};

/**
 * Build WHERE conditions from filter options.
 *
 * Defaults (no options): non-deleted sales only.
 *
 * NOTE: When using `search`, the query MUST include LEFT JOINs on
 * `customers` and `users` tables (as `getAllSales` does).
 */
function buildSaleConditions(opts: SaleFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (!opts.includeDeleted) {
		conditions.push(isNull(sales.deletedAt));
	}

	if (opts.status) {
		conditions.push(eq(sales.status, opts.status));
	}

	if (opts.customerId) {
		conditions.push(eq(sales.customerId, opts.customerId));
	}

	if (opts.sellerId) {
		conditions.push(eq(sales.sellerId, opts.sellerId));
	}

	if (opts.dateFrom) {
		conditions.push(gte(sales.saleDate, opts.dateFrom));
	}

	if (opts.dateTo) {
		conditions.push(lte(sales.saleDate, toUTCString(toEndOfDay(fromISODate(opts.dateTo)!))));
	}

	if (opts.search) {
		const rawSearch = opts.search.trim();
		const pattern = `%${rawSearch}%`;
		const searchConditions: SQL[] = [
			ilike(customers.firstName, pattern),
			ilike(customers.lastName, pattern),
			ilike(customers.idNumber, pattern),
			ilike(users.fullName, pattern)
		];

		const normalizedOrderNumber = rawSearch.replace(/^#/, '');
		if (/^\d+$/.test(normalizedOrderNumber)) {
			searchConditions.push(eq(sales.orderNumber, Number(normalizedOrderNumber)));
		}

		conditions.push(or(...searchConditions)!);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

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
				idNumber: customers.idNumber
			},
			seller: { id: users.id, fullName: users.fullName }
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.$dynamic();

	if (where) base.where(where);
	base.orderBy(orderFn(orderCol));
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	const results = await base;

	return results.map((r) => ({
		...r.sale,
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
			monthly: sql<number>`count(*) filter (where ${sales.saleDate} >= ${monthStartIso})`.mapWith(
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
				idNumber: customers.idNumber
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
		customer: result.customer?.id ? result.customer : null,
		seller: result.seller?.id ? result.seller : null,
		cancelledBy: result.cancelledBy?.id ? result.cancelledBy : null,
		refundedBy: result.refundedBy?.id ? result.refundedBy : null
	};
}

/**
 * Create a new sale
 */
export async function createSale(data: NewSale): Promise<Sale> {
	const now = nowISO();
	const [sale] = await db
		.insert(sales)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return sale;
}

/**
 * Update a sale by ID
 */
export async function updateSale(
	id: string,
	data: Partial<Omit<Sale, 'id' | 'createdAt'>>,
	executor: DbOrTx = db
): Promise<Sale | null> {
	const [sale] = await executor
		.update(sales)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(sales.id, id))
		.returning();
	return sale ?? null;
}

// ============================================================================
// SALE ITEMS
// ============================================================================

/**
 * Get sale items with product AND lens catalog info
 */
export async function getSaleItemsWithDetails(saleId: string): Promise<SaleItemWithDetails[]> {
	const results = await db
		.select({
			item: saleItems,
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
			}
		})
		.from(saleItems)
		.leftJoin(products, eq(saleItems.productId, products.id))
		.leftJoin(lensCatalogItems, eq(saleItems.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(supplierTreatments, eq(saleItems.supplierTreatmentId, supplierTreatments.id))
		.where(and(eq(saleItems.saleId, saleId), isNull(saleItems.deletedAt)));

	return results.map((r) => ({
		...r.item,
		product: r.product?.id ? r.product : null,
		lensCatalogItem: r.lensCatalogItem?.id ? r.lensCatalogItem : null,
		supplierTreatment: r.supplierTreatment?.id ? r.supplierTreatment : null
	}));
}

/**
 * Create a sale item
 */
export async function createSaleItem(data: NewSaleItem): Promise<SaleItem> {
	const now = nowISO();
	const [item] = await db
		.insert(saleItems)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return item;
}

/**
 * Create multiple sale items
 */
export async function createSaleItems(items: NewSaleItem[]): Promise<SaleItem[]> {
	const now = nowISO();
	return await db
		.insert(saleItems)
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
 * Update a sale item's internal cost fields
 */
export async function updateSaleItemCosts(
	id: string,
	data: {
		snapshotBaseCost: number | null;
		snapshotMountingPrice: number | null;
		snapshotShippingPrice: number | null;
		shippingCostPending: boolean;
	},
	executor: DbOrTx = db
): Promise<SaleItem | null> {
	const [item] = await executor
		.update(saleItems)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(saleItems.id, id))
		.returning();
	return item ?? null;
}

// ============================================================================
// SALE PAYMENTS
// ============================================================================

/**
 * Get payments for a sale
 *
 * @param includeVoided - If true, includes voided payments for history (default: false)
 */
export async function getSalePayments(
	saleId: string,
	{ includeVoided = false }: { includeVoided?: boolean } = {}
): Promise<SalePayment[]> {
	const conditions = [eq(salePayments.saleId, saleId)];
	if (!includeVoided) {
		conditions.push(isNull(salePayments.voidedAt));
	}
	return await db
		.select()
		.from(salePayments)
		.where(and(...conditions))
		.orderBy(desc(salePayments.paymentDate), desc(salePayments.createdAt));
}

/**
 * Find a payment by ID
 */
export async function findPaymentById(
	id: string,
	executor: DbOrTx = db
): Promise<SalePayment | null> {
	const [payment] = await executor
		.select()
		.from(salePayments)
		.where(and(eq(salePayments.id, id), isNull(salePayments.voidedAt)));
	return payment ?? null;
}

/**
 * Add a payment to a sale
 */
export async function addSalePayment(
	data: NewSalePayment,
	executor: DbOrTx = db
): Promise<SalePayment> {
	const now = nowISO();
	const [payment] = await executor
		.insert(salePayments)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return payment;
}

/**
 * Void a payment (soft-delete by setting voidedAt)
 */
export async function voidSalePayment(
	id: string,
	executor: DbOrTx = db
): Promise<SalePayment | null> {
	const [payment] = await executor
		.update(salePayments)
		.set({ voidedAt: nowISO(), updatedAt: nowISO() })
		.where(and(eq(salePayments.id, id), isNull(salePayments.voidedAt)))
		.returning();
	return payment ?? null;
}

/**
 * Recalculate and update the total paid amount (BCV USD) for a sale.
 * Sums all non-voided payments' amountBcvUsd.
 * Returns the new paidAmountBcvUsd value.
 */
export async function recalcSalePaidAmount(saleId: string, executor: DbOrTx = db): Promise<number> {
	const [result] = await executor
		.select({ total: sum(salePayments.amountBcvUsd) })
		.from(salePayments)
		.where(and(eq(salePayments.saleId, saleId), isNull(salePayments.voidedAt)));

	const paidAmount = Number(result?.total ?? 0);

	await executor
		.update(sales)
		.set({ paidAmountBcvUsd: paidAmount, updatedAt: nowISO() })
		.where(eq(sales.id, saleId));

	return paidAmount;
}
