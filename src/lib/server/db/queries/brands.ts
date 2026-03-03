import { eq, isNull, isNotNull, and, ilike, count, asc, desc, type AnyColumn } from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { brands, products, type Brand, type NewBrand } from '$lib/server/db/schema';
import type { InferSelectedRow } from '$lib/server/db/types';

/** Sortable brand columns */
export type BrandOrderBy = 'name' | 'createdAt' | 'updatedAt' | 'country';

/** Options for querying brands */
export interface GetBrandsOptions {
	/** Include soft-deleted brands in results (default: false) */
	includeDeleted?: boolean;
	/** Column to order by */
	orderBy?: BrandOrderBy;
	/** Sort direction (default: 'asc') */
	orderSort?: 'asc' | 'desc';
	/** Maximum number of results to return */
	limit?: number;
	/** Number of results to skip (for pagination) */
	offset?: number;
}

/** Query with column projection */
export interface GetBrandsQuery<
	T extends SelectedFields = SelectedFields
> extends GetBrandsOptions {
	columns: T;
}

/** Column map for orderBy */
const ORDER_COLUMNS: Record<BrandOrderBy, AnyColumn> = {
	name: brands.name,
	createdAt: brands.createdAt,
	updatedAt: brands.updatedAt,
	country: brands.country
};

/**
 * Get all brands (excluding soft-deleted by default)
 *
 * @example
 * getAllBrands()                                            // → Brand[]
 * getAllBrands({ orderBy: 'createdAt', limit: 10 })         // → Brand[]
 * getAllBrands({ columns: { id: brands.id, name: brands.name } }) // → { id, name }[]
 */
export async function getAllBrands<T extends SelectedFields>(
	query: GetBrandsQuery<T>
): Promise<InferSelectedRow<T>[]>;
export async function getAllBrands(options?: GetBrandsOptions): Promise<Brand[]>;
export async function getAllBrands<T extends SelectedFields>(
	optionsOrQuery?: GetBrandsOptions | GetBrandsQuery<T>
): Promise<Brand[] | InferSelectedRow<T>[]> {
	const columns =
		optionsOrQuery && 'columns' in optionsOrQuery ? optionsOrQuery.columns : undefined;
	const opts = optionsOrQuery ?? {};

	// Build WHERE
	const whereClause = opts.includeDeleted ? undefined : isNull(brands.deletedAt);

	// Build ORDER BY
	const orderFn = opts.orderSort === 'desc' ? desc : asc;
	const orderClause = opts.orderBy ? orderFn(ORDER_COLUMNS[opts.orderBy]) : undefined;

	// Build query with $dynamic() to allow conditional chaining
	const base = columns
		? db.select(columns).from(brands).$dynamic()
		: db.select().from(brands).$dynamic();

	if (whereClause) base.where(whereClause);
	if (orderClause) base.orderBy(orderClause);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);
	return await base;
}

/**
 * Find a brand by ID
 * @param deleted - If true, also matches soft-deleted brands (default: false)
 */
export async function findBrandById(
	id: string,
	{ deleted }: { deleted?: boolean } = {}
): Promise<Brand | null> {
	const filter = deleted ? eq(brands.id, id) : and(eq(brands.id, id), isNull(brands.deletedAt));
	const [brand] = await db.select().from(brands).where(filter);
	return brand ?? null;
}

/**
 * Find a brand by name (case-insensitive)
 * @param deleted - If true, matches only soft-deleted brands. If false (default), matches only active brands.
 */
export async function findBrandByName(
	name: string,
	{ deleted = false }: { deleted?: boolean } = {}
): Promise<Brand | null> {
	const filter = deleted ? isNotNull(brands.deletedAt) : isNull(brands.deletedAt);
	const [brand] = await db
		.select()
		.from(brands)
		.where(and(ilike(brands.name, name), filter));
	return brand ?? null;
}

/**
 * Create a new brand
 */
export async function createBrand(data: NewBrand): Promise<Brand> {
	const now = new Date();
	const [brand] = await db
		.insert(brands)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return brand;
}

/**
 * Update a brand by ID
 */
export async function updateBrand(
	id: string,
	data: Partial<Omit<Brand, 'id' | 'createdAt'>>
): Promise<Brand | null> {
	const [brand] = await db
		.update(brands)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(brands.id, id))
		.returning();
	return brand ?? null;
}

/**
 * Soft delete a brand by ID
 */
export async function deleteBrand(id: string): Promise<boolean> {
	const result = await db
		.update(brands)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(brands.id, id));
	return result.count > 0;
}

/**
 * Count products associated with a brand
 */
export async function countProductsByBrand(brandId: string): Promise<number> {
	const [result] = await db
		.select({ count: count() })
		.from(products)
		.where(and(eq(products.brandId, brandId), isNull(products.deletedAt)));
	return result?.count ?? 0;
}

/**
 * Restore a soft-deleted brand
 */
export async function restoreBrand(id: string): Promise<Brand> {
	const [brand] = await db
		.update(brands)
		.set({
			deletedAt: null,
			updatedAt: new Date()
		})
		.where(eq(brands.id, id))
		.returning();
	return brand;
}
