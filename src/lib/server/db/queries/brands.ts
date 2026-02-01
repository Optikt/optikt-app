import { eq, isNull, and, ilike, count } from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { brands, products, type Brand, type NewBrand } from '$lib/server/db/schema';

/**
 * Get all brands (excluding soft-deleted)
 * @param columns - Optional columns to select (default: all columns)
 */
export async function getAllBrands(): Promise<Brand[]>;
export async function getAllBrands<T extends SelectedFields>(
	columns: T
): Promise<{ [K in keyof T]: T[K] extends { _: { data: infer D } } ? D : never }[]>;
export async function getAllBrands<T extends SelectedFields>(columns?: T) {
	if (columns) {
		return await db.select(columns).from(brands).where(isNull(brands.deletedAt));
	}
	return await db.select().from(brands).where(isNull(brands.deletedAt));
}

/**
 * Find a brand by ID
 */
export async function findBrandById(id: string): Promise<Brand | null> {
	const [brand] = await db
		.select()
		.from(brands)
		.where(and(eq(brands.id, id), isNull(brands.deletedAt)));
	return brand ?? null;
}

/**
 * Find a brand by name (case-insensitive)
 */
export async function findBrandByName(name: string): Promise<Brand | null> {
	const [brand] = await db
		.select()
		.from(brands)
		.where(and(ilike(brands.name, name), isNull(brands.deletedAt)));
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
