import { eq, isNull, and, desc, between } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	sales,
	saleItems,
	customers,
	users,
	products,
	type Sale,
	type NewSale,
	type SaleItem,
	type NewSaleItem
} from '$lib/server/db/schema';

// ============================================================================
// SALES
// ============================================================================

export type SaleWithRelations = Sale & {
	customer: { id: string; firstName: string; lastName: string } | null;
	seller: { id: string; fullName: string } | null;
};

/**
 * Get all sales (excluding soft-deleted), most recent first
 */
export async function getAllSales(): Promise<Sale[]> {
	return await db.select().from(sales).where(isNull(sales.deletedAt)).orderBy(desc(sales.saleDate));
}

/**
 * Get sales with customer and seller info
 */
export async function getSalesWithRelations(): Promise<SaleWithRelations[]> {
	const results = await db
		.select({
			sale: sales,
			customer: {
				id: customers.id,
				firstName: customers.firstName,
				lastName: customers.lastName
			},
			seller: { id: users.id, fullName: users.fullName }
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.where(isNull(sales.deletedAt))
		.orderBy(desc(sales.saleDate));

	return results.map((r) => ({
		...r.sale,
		customer: r.customer,
		seller: r.seller
	}));
}

/**
 * Get sales within a date range
 */
export async function getSalesByDateRange(startDate: Date, endDate: Date): Promise<Sale[]> {
	return await db
		.select()
		.from(sales)
		.where(and(isNull(sales.deletedAt), between(sales.saleDate, startDate, endDate)))
		.orderBy(desc(sales.saleDate));
}

/**
 * Get sales for a specific customer
 */
export async function getCustomerSales(customerId: string): Promise<Sale[]> {
	return await db
		.select()
		.from(sales)
		.where(and(eq(sales.customerId, customerId), isNull(sales.deletedAt)))
		.orderBy(desc(sales.saleDate));
}

/**
 * Get sales by a specific seller
 */
export async function getSellerSales(sellerId: string): Promise<Sale[]> {
	return await db
		.select()
		.from(sales)
		.where(and(eq(sales.sellerId, sellerId), isNull(sales.deletedAt)))
		.orderBy(desc(sales.saleDate));
}

/**
 * Find a sale by ID
 */
export async function findSaleById(id: string): Promise<Sale | null> {
	const [sale] = await db
		.select()
		.from(sales)
		.where(and(eq(sales.id, id), isNull(sales.deletedAt)));
	return sale ?? null;
}

/**
 * Create a new sale
 */
export async function createSale(data: NewSale): Promise<Sale> {
	const now = new Date();
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
	data: Partial<Omit<Sale, 'id' | 'createdAt'>>
): Promise<Sale | null> {
	const [sale] = await db
		.update(sales)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(sales.id, id))
		.returning();
	return sale ?? null;
}

/**
 * Update sale status
 */
export async function updateSaleStatus(id: string, status: string): Promise<void> {
	await db.update(sales).set({ status, updatedAt: new Date() }).where(eq(sales.id, id));
}

// ============================================================================
// SALE ITEMS
// ============================================================================

export type SaleItemWithProduct = SaleItem & {
	product: { id: string; name: string; sku: string } | null;
};

/**
 * Get all items for a sale
 */
export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
	return await db
		.select()
		.from(saleItems)
		.where(and(eq(saleItems.saleId, saleId), isNull(saleItems.deletedAt)));
}

/**
 * Get sale items with product info
 */
export async function getSaleItemsWithProducts(saleId: string): Promise<SaleItemWithProduct[]> {
	const results = await db
		.select({
			item: saleItems,
			product: { id: products.id, name: products.name, sku: products.sku }
		})
		.from(saleItems)
		.leftJoin(products, eq(saleItems.productId, products.id))
		.where(and(eq(saleItems.saleId, saleId), isNull(saleItems.deletedAt)));

	return results.map((r) => ({
		...r.item,
		product: r.product
	}));
}

/**
 * Create a sale item
 */
export async function createSaleItem(data: NewSaleItem): Promise<SaleItem> {
	const now = new Date();
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
	const now = new Date();
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
