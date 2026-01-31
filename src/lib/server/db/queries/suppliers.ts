import { eq, isNull, and, ilike } from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { suppliers, type Supplier, type NewSupplier } from '$lib/server/db/schema';

/**
 * Get all suppliers (excluding soft-deleted)
 * @param columns - Optional columns to select (default: all columns)
 */
export async function getAllSuppliers(): Promise<Supplier[]>;
export async function getAllSuppliers<T extends SelectedFields>(
	columns: T
): Promise<{ [K in keyof T]: T[K] extends { _: { data: infer D } } ? D : never }[]>;
export async function getAllSuppliers<T extends SelectedFields>(columns?: T) {
	if (columns) {
		return await db.select(columns).from(suppliers).where(isNull(suppliers.deletedAt));
	}
	return await db.select().from(suppliers).where(isNull(suppliers.deletedAt));
}

/**
 * Find a supplier by ID
 */
export async function findSupplierById(id: string): Promise<Supplier | null> {
	const [supplier] = await db
		.select()
		.from(suppliers)
		.where(and(eq(suppliers.id, id), isNull(suppliers.deletedAt)));
	return supplier ?? null;
}

/**
 * Find a supplier by name (case-insensitive)
 */
export async function findSupplierByName(name: string): Promise<Supplier | null> {
	const [supplier] = await db
		.select()
		.from(suppliers)
		.where(and(ilike(suppliers.name, name), isNull(suppliers.deletedAt)));
	return supplier ?? null;
}

/**
 * Find a supplier by RIF
 */
export async function findSupplierByRif(rif: string): Promise<Supplier | null> {
	const [supplier] = await db
		.select()
		.from(suppliers)
		.where(and(eq(suppliers.rif, rif), isNull(suppliers.deletedAt)));
	return supplier ?? null;
}

/**
 * Create a new supplier
 */
export async function createSupplier(data: NewSupplier): Promise<Supplier> {
	const now = new Date();
	const [supplier] = await db
		.insert(suppliers)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return supplier;
}

/**
 * Quick create a supplier with minimal info (for inline creation)
 * Defaults type to 'DISTRIBUTOR' and primaryPhone to empty string
 */
export async function quickCreateSupplier(name: string): Promise<Supplier> {
	return createSupplier({
		name,
		type: 'DISTRIBUTOR',
		primaryPhone: ''
	});
}

/**
 * Update a supplier by ID
 */
export async function updateSupplier(
	id: string,
	data: Partial<Omit<Supplier, 'id' | 'createdAt'>>
): Promise<Supplier | null> {
	const [supplier] = await db
		.update(suppliers)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(suppliers.id, id))
		.returning();
	return supplier ?? null;
}

/**
 * Soft delete a supplier by ID
 */
export async function deleteSupplier(id: string): Promise<boolean> {
	const result = await db
		.update(suppliers)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(eq(suppliers.id, id));
	return result.count > 0;
}
