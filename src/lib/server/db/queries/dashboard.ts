import { eq, isNull, and, gte, lte, count, sum, sql, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	sales,
	quotes,
	products,
	lensCatalogItems,
	customers,
	type Sale
} from '$lib/server/db/schema';
import { todayEnd, todayStart, toUTCString } from '$lib/dates';

// ============================================================================
// TYPES
// ============================================================================

export interface DashboardStats {
	salesToday: { count: number; total: number };
	pendingQuotes: number;
	pendingPayments: { count: number; amount: number };
	lowStockProducts: number;
	lowStockLenses: number;
	totalCustomers: number;
}

export type RecentSale = Pick<
	Sale,
	'id' | 'orderNumber' | 'total' | 'status' | 'saleDate' | 'paidAmountBcvUsd'
> & {
	customer: { firstName: string; lastName: string } | null;
};

export interface LowStockItem {
	id: string;
	name: string;
	sku: string | null;
	type: 'product' | 'lens';
	stock: number;
	minStock: number | null;
}

// ============================================================================
// QUERIES
// ============================================================================

/** Get all dashboard stats in one call (parallel queries). */
export async function getDashboardStats(): Promise<DashboardStats> {
	const todayStr = toUTCString(todayStart());
	const endOfDayStr = toUTCString(todayEnd());

	const [
		salesToday,
		pendingQuotes,
		pendingPayments,
		lowStockProducts,
		lowStockLenses,
		totalCustomers
	] = await Promise.all([
		// Sales today (non-deleted, non-cancelled)
		db
			.select({
				count: count(),
				total: sum(sales.total)
			})
			.from(sales)
			.where(
				and(
					isNull(sales.deletedAt),
					gte(sales.saleDate, todayStr),
					lte(sales.saleDate, endOfDayStr),
					sql`${sales.status} != 'CANCELLED'`
				)
			)
			.then(([r]) => ({ count: r.count, total: Number(r.total ?? 0) })),

		// Pending quotes (DRAFT status, non-deleted)
		db
			.select({ value: count() })
			.from(quotes)
			.where(and(isNull(quotes.deletedAt), eq(quotes.status, 'DRAFT')))
			.then(([r]) => r.value),

		// Pending payments (PENDING sales with outstanding balance)
		db
			.select({
				count: count(),
				amount: sum(sql<number>`${sales.total} - ${sales.paidAmountBcvUsd}`)
			})
			.from(sales)
			.where(and(isNull(sales.deletedAt), eq(sales.status, 'PENDING')))
			.then(([r]) => ({ count: r.count, amount: Number(r.amount ?? 0) })),

		// Low stock products (stock ≤ minStock, active, non-deleted)
		db
			.select({ value: count() })
			.from(products)
			.where(
				and(
					isNull(products.deletedAt),
					eq(products.isActive, true),
					lte(products.stock, products.minStock)
				)
			)
			.then(([r]) => r.value),

		// Low stock lenses (STOCK mode, stock ≤ 0, active, non-deleted)
		db
			.select({ value: count() })
			.from(lensCatalogItems)
			.where(
				and(
					isNull(lensCatalogItems.deletedAt),
					eq(lensCatalogItems.isActive, true),
					eq(lensCatalogItems.inventoryMode, 'STOCK'),
					lte(lensCatalogItems.stock, 0)
				)
			)
			.then(([r]) => r.value),

		// Total customers (non-deleted)
		db
			.select({ value: count() })
			.from(customers)
			.where(isNull(customers.deletedAt))
			.then(([r]) => r.value)
	]);

	return {
		salesToday,
		pendingQuotes,
		pendingPayments,
		lowStockProducts,
		lowStockLenses,
		totalCustomers
	};
}

/** Get latest sales with customer info. */
export async function getRecentSales(limit = 5): Promise<RecentSale[]> {
	const results = await db
		.select({
			id: sales.id,
			orderNumber: sales.orderNumber,
			total: sales.total,
			status: sales.status,
			saleDate: sales.saleDate,
			paidAmountBcvUsd: sales.paidAmountBcvUsd,
			customerFirstName: customers.firstName,
			customerLastName: customers.lastName
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.where(and(isNull(sales.deletedAt), sql`${sales.status} != 'CANCELLED'`))
		.orderBy(desc(sales.createdAt))
		.limit(limit);

	return results.map((r) => ({
		id: r.id,
		orderNumber: r.orderNumber,
		total: r.total,
		status: r.status,
		saleDate: r.saleDate,
		paidAmountBcvUsd: r.paidAmountBcvUsd,
		customer: r.customerFirstName
			? { firstName: r.customerFirstName, lastName: r.customerLastName! }
			: null
	}));
}

/** Get items with low or zero stock (products + STOCK lenses). */
export async function getLowStockItems(limit = 10): Promise<LowStockItem[]> {
	const [lowProducts, lowLenses] = await Promise.all([
		db
			.select({
				id: products.id,
				name: products.name,
				sku: products.sku,
				stock: products.stock,
				minStock: products.minStock
			})
			.from(products)
			.where(
				and(
					isNull(products.deletedAt),
					eq(products.isActive, true),
					lte(products.stock, products.minStock)
				)
			)
			.limit(limit),

		db
			.select({
				id: lensCatalogItems.id,
				name: lensCatalogItems.name,
				stock: lensCatalogItems.stock
			})
			.from(lensCatalogItems)
			.where(
				and(
					isNull(lensCatalogItems.deletedAt),
					eq(lensCatalogItems.isActive, true),
					eq(lensCatalogItems.inventoryMode, 'STOCK'),
					lte(lensCatalogItems.stock, 0)
				)
			)
			.limit(limit)
	]);

	const items: LowStockItem[] = [
		...lowProducts.map((p) => ({
			id: p.id,
			name: p.name,
			sku: p.sku,
			type: 'product' as const,
			stock: p.stock ?? 0,
			minStock: p.minStock
		})),
		...lowLenses.map((l) => ({
			id: l.id,
			name: l.name,
			sku: null,
			type: 'lens' as const,
			stock: l.stock ?? 0,
			minStock: null
		}))
	];

	return items;
}
