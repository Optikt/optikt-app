import { eq, isNull, and, ilike, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { products, brands, suppliers, type Product, type NewProduct } from '$lib/server/db/schema';

// Product with related brand and supplier data
export type ProductWithRelations = Product & {
	brand: { id: string; name: string } | null;
	supplier: { id: string; name: string } | null;
};

/**
 * Get all products (excluding soft-deleted)
 */
export async function getAllProducts(): Promise<Product[]> {
	return await db.select().from(products).where(isNull(products.deletedAt));
}

/**
 * Get all products with brand and supplier info (including inactive, excluding deleted)
 */
export async function getAllProductsWithRelations(): Promise<ProductWithRelations[]> {
	const results = await db
		.select({
			product: products,
			brand: { id: brands.id, name: brands.name },
			supplier: { id: suppliers.id, name: suppliers.name }
		})
		.from(products)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(suppliers, eq(products.supplierId, suppliers.id))
		.where(isNull(products.deletedAt));

	return results.map((r) => ({
		...r.product,
		brand: r.brand?.id ? r.brand : null,
		supplier: r.supplier?.id ? r.supplier : null
	}));
}

/**
 * Get all active products with brand and supplier info
 */
export async function getActiveProductsWithRelations(): Promise<ProductWithRelations[]> {
	const results = await db
		.select({
			product: products,
			brand: { id: brands.id, name: brands.name },
			supplier: { id: suppliers.id, name: suppliers.name }
		})
		.from(products)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(suppliers, eq(products.supplierId, suppliers.id))
		.where(and(isNull(products.deletedAt), eq(products.isActive, true)));

	return results.map((r) => ({
		...r.product,
		brand: r.brand?.id ? r.brand : null,
		supplier: r.supplier?.id ? r.supplier : null
	}));
}

/**
 * Find a product by ID (including inactive)
 */
export async function findProductById(id: string): Promise<Product | null> {
	const [product] = await db
		.select()
		.from(products)
		.where(and(eq(products.id, id), isNull(products.deletedAt)));
	return product ?? null;
}

/**
 * Find a product by ID with relations
 */
export async function findProductByIdWithRelations(
	id: string
): Promise<ProductWithRelations | null> {
	const results = await db
		.select({
			product: products,
			brand: { id: brands.id, name: brands.name },
			supplier: { id: suppliers.id, name: suppliers.name }
		})
		.from(products)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(suppliers, eq(products.supplierId, suppliers.id))
		.where(and(eq(products.id, id), isNull(products.deletedAt)));

	if (results.length === 0) return null;

	const r = results[0];
	return {
		...r.product,
		brand: r.brand?.id ? r.brand : null,
		supplier: r.supplier?.id ? r.supplier : null
	};
}

/**
 * Find a product by SKU (only active, non-deleted)
 */
export async function findProductBySku(sku: string): Promise<Product | null> {
	const [product] = await db
		.select()
		.from(products)
		.where(and(eq(products.sku, sku), isNull(products.deletedAt)));
	return product ?? null;
}

/**
 * Find a product by SKU including soft-deleted (for duplicate check)
 */
export async function findProductBySkuIncludingDeleted(sku: string): Promise<Product | null> {
	const [product] = await db.select().from(products).where(eq(products.sku, sku));
	return product ?? null;
}

/**
 * Find a product by SKU, excluding a specific ID (for update validation)
 */
export async function findProductBySkuExcluding(
	sku: string,
	excludeId: string
): Promise<Product | null> {
	const [product] = await db
		.select()
		.from(products)
		.where(and(eq(products.sku, sku), ne(products.id, excludeId), isNull(products.deletedAt)));
	return product ?? null;
}

/**
 * Search products by name or SKU (case-insensitive)
 */
export async function searchProducts(query: string): Promise<Product[]> {
	return await db
		.select()
		.from(products)
		.where(
			and(
				or(ilike(products.name, `%${query}%`), ilike(products.sku, `%${query}%`)),
				isNull(products.deletedAt)
			)
		);
}

/**
 * Get products with low stock
 */
export async function getLowStockProducts(): Promise<Product[]> {
	return await db
		.select()
		.from(products)
		.where(
			and(
				isNull(products.deletedAt),
				eq(products.isActive, true),
				lte(products.stock, products.minStock)
			)
		);
}

/**
 * Create a new product
 */
export async function createProduct(data: NewProduct): Promise<Product> {
	const now = new Date();
	const [product] = await db
		.insert(products)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return product;
}

/**
 * Update a product by ID
 */
export async function updateProduct(
	id: string,
	data: Partial<Omit<Product, 'id' | 'createdAt'>>
): Promise<Product | null> {
	const [product] = await db
		.update(products)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(products.id, id))
		.returning();
	return product ?? null;
}

/**
 * Update product stock
 */
export async function updateProductStock(id: string, quantity: number): Promise<void> {
	await db
		.update(products)
		.set({ stock: quantity, updatedAt: new Date() })
		.where(eq(products.id, id));
}

/**
 * Soft delete a product by ID
 */
export async function deleteProduct(id: string): Promise<boolean> {
	const result = await db
		.update(products)
		.set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
		.where(eq(products.id, id));
	return result.count > 0;
}

/**
 * Reactivate a soft-deleted product
 */
export async function reactivateProduct(id: string): Promise<Product | null> {
	const [product] = await db
		.update(products)
		.set({ deletedAt: null, isActive: true, updatedAt: new Date() })
		.where(eq(products.id, id))
		.returning();
	return product ?? null;
}

/**
 * Get count of products (for pagination)
 */
export async function getProductCount(includeInactive = false): Promise<number> {
	const conditions = [isNull(products.deletedAt)];
	if (!includeInactive) {
		conditions.push(eq(products.isActive, true));
	}

	const result = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(products)
		.where(and(...conditions));

	return result[0]?.count ?? 0;
}
