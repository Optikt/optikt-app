import {
	eq,
	isNull,
	isNotNull,
	and,
	or,
	lte,
	asc,
	desc,
	ilike,
	count,
	type AnyColumn,
	type SQL
} from 'drizzle-orm';
import { db } from '$lib/server/db';
import { products, brands, suppliers, materials, type Product } from '$lib/server/db/schema';

// Product with related brand and supplier data
export type ProductWithRelations = Product & {
	brand: { id: string; name: string } | null;
	supplier: { id: string; name: string } | null;
	material: { id: string; name: string; code: string } | null;
};

/** Sortable product columns */
export type ProductOrderBy = 'name' | 'sku' | 'salePrice' | 'stock' | 'createdAt' | 'updatedAt';

/** Options for filtering products (shared between query and count) */
export interface ProductFilterOptions {
	/** Include soft-deleted products in results (default: false) */
	includeDeleted?: boolean;
	/** Include inactive products in results (default: false — only active shown) */
	includeInactive?: boolean;
	/** Search by name or SKU (case-insensitive) */
	search?: string;
	/** Filter by product type */
	type?: string;
	/** Filter by brand ID */
	brandId?: string;
	/** Filter by supplier ID */
	supplierId?: string;
	/** Only show products where stock <= minStock */
	lowStockOnly?: boolean;
}

/** Options for querying products with relations */
export interface GetProductsOptions extends ProductFilterOptions {
	/** Column to order by */
	orderBy?: ProductOrderBy;
	/** Sort direction (default: 'asc') */
	orderSort?: 'asc' | 'desc';
	/** Maximum number of results to return */
	limit?: number;
	/** Number of results to skip (for pagination) */
	offset?: number;
}

/** Column map for orderBy */
const ORDER_COLUMNS: Record<ProductOrderBy, AnyColumn> = {
	name: products.name,
	sku: products.sku,
	salePrice: products.salePrice,
	stock: products.stock,
	createdAt: products.createdAt,
	updatedAt: products.updatedAt
};

/**
 * Build WHERE conditions from filter options.
 *
 * Defaults (no options): active, non-deleted products only.
 */
function buildProductConditions(opts: ProductFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (!opts.includeDeleted) {
		conditions.push(isNull(products.deletedAt));
	}

	if (!opts.includeInactive) {
		if (opts.includeDeleted) {
			// Keep active OR deleted (deleted products have isActive=false by design)
			conditions.push(or(eq(products.isActive, true), isNotNull(products.deletedAt))!);
		} else {
			conditions.push(eq(products.isActive, true));
		}
	}

	if (opts.search) {
		conditions.push(
			or(ilike(products.name, `%${opts.search}%`), ilike(products.sku, `%${opts.search}%`))!
		);
	}

	if (opts.type) {
		conditions.push(eq(products.type, opts.type));
	}

	if (opts.brandId) {
		conditions.push(eq(products.brandId, opts.brandId));
	}

	if (opts.supplierId) {
		conditions.push(eq(products.supplierId, opts.supplierId));
	}

	if (opts.lowStockOnly) {
		conditions.push(isNotNull(products.stock));
		conditions.push(isNotNull(products.minStock));
		conditions.push(lte(products.stock, products.minStock));
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

/**
 * Get all products with brand, supplier, and material info
 *
 * @example
 * getAllProductsWithRelations()                                             // active, non-deleted
 * getAllProductsWithRelations({ includeInactive: true })                    // all non-deleted
 * getAllProductsWithRelations({ includeDeleted: true })                     // active + deleted
 * getAllProductsWithRelations({ search: 'ray', type: 'FRAME', limit: 10 }) // filtered + paginated
 */
export async function getAllProductsWithRelations(
	options?: GetProductsOptions
): Promise<ProductWithRelations[]> {
	const opts = options ?? {};
	const where = buildProductConditions(opts);

	// Build ORDER BY
	const orderFn = opts.orderSort === 'desc' ? desc : asc;
	const orderClause = opts.orderBy ? orderFn(ORDER_COLUMNS[opts.orderBy]) : undefined;

	const base = db
		.select({
			product: products,
			brand: { id: brands.id, name: brands.name },
			supplier: { id: suppliers.id, name: suppliers.name },
			material: { id: materials.id, name: materials.name, code: materials.code }
		})
		.from(products)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(suppliers, eq(products.supplierId, suppliers.id))
		.leftJoin(materials, eq(products.materialId, materials.id))
		.$dynamic();

	if (where) base.where(where);
	if (orderClause) base.orderBy(orderClause);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	const results = await base;

	return results.map((r) => ({
		...r.product,
		brand: r.brand?.id ? r.brand : null,
		supplier: r.supplier?.id ? r.supplier : null,
		material: r.material?.id ? r.material : null
	}));
}

/**
 * Count products matching the given filters (no JOINs needed).
 * Uses the same conditions as getAllProductsWithRelations.
 */
export async function countProducts(options?: ProductFilterOptions): Promise<number> {
	const where = buildProductConditions(options ?? {});
	const base = db.select({ value: count() }).from(products).$dynamic();
	if (where) base.where(where);
	const [result] = await base;
	return result.value;
}

/**
 * Find a product by ID
 * @param deleted - If true, also matches soft-deleted products (default: false)
 */
export async function findProductById(
	id: string,
	{ deleted }: { deleted?: boolean } = {}
): Promise<Product | null> {
	const filter = deleted
		? eq(products.id, id)
		: and(eq(products.id, id), isNull(products.deletedAt));
	const [product] = await db.select().from(products).where(filter);
	return product ?? null;
}

/**
 * Find a product by ID with relations
 * @param deleted - If true, also matches soft-deleted products (default: false)
 */
export async function findProductByIdWithRelations(
	id: string,
	{ deleted }: { deleted?: boolean } = {}
): Promise<ProductWithRelations | null> {
	const filter = deleted
		? eq(products.id, id)
		: and(eq(products.id, id), isNull(products.deletedAt));

	const results = await db
		.select({
			product: products,
			brand: { id: brands.id, name: brands.name },
			supplier: { id: suppliers.id, name: suppliers.name },
			material: { id: materials.id, name: materials.name, code: materials.code }
		})
		.from(products)
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(suppliers, eq(products.supplierId, suppliers.id))
		.leftJoin(materials, eq(products.materialId, materials.id))
		.where(filter);

	if (results.length === 0) return null;

	const r = results[0];
	return {
		...r.product,
		brand: r.brand?.id ? r.brand : null,
		supplier: r.supplier?.id ? r.supplier : null,
		material: r.material?.id ? r.material : null
	};
}

/**
 * Find a product by SKU
 * @param deleted - 'exclude' (default): active only, 'only': deleted only, 'include': all
 */
export async function findProductBySku(
	sku: string,
	{ deleted = 'exclude' }: { deleted?: 'exclude' | 'only' | 'include' } = {}
): Promise<Product | null> {
	const conditions = [eq(products.sku, sku)];
	if (deleted === 'exclude') {
		conditions.push(isNull(products.deletedAt));
	} else if (deleted === 'only') {
		conditions.push(isNotNull(products.deletedAt));
	}
	const [product] = await db
		.select()
		.from(products)
		.where(and(...conditions));
	return product ?? null;
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
 * Restore a soft-deleted product with new data
 */
export async function restoreProduct(id: string): Promise<Product | null> {
	const [product] = await db
		.update(products)
		.set({ deletedAt: null, isActive: true, updatedAt: new Date() })
		.where(eq(products.id, id))
		.returning();
	return product ?? null;
}
