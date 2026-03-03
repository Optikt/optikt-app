import { eq, isNull, isNotNull, and, ilike, asc, desc, type AnyColumn } from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { suppliers, type Supplier, type NewSupplier } from '$lib/server/db/schema';
import type { InferSelectedRow } from '$lib/server/db/types';

/** Sortable supplier columns */
export type SupplierOrderBy = 'name' | 'type' | 'createdAt' | 'updatedAt';

/** Options for querying suppliers */
export interface GetSuppliersOptions {
	/** Include soft-deleted suppliers in results (default: false) */
	includeDeleted?: boolean;
	/** Column to order by */
	orderBy?: SupplierOrderBy;
	/** Sort direction (default: 'asc') */
	orderSort?: 'asc' | 'desc';
	/** Maximum number of results to return */
	limit?: number;
	/** Number of results to skip (for pagination) */
	offset?: number;
}

/** Query with column projection */
export interface GetSuppliersQuery<
	T extends SelectedFields = SelectedFields
> extends GetSuppliersOptions {
	columns: T;
}

/** Column map for orderBy */
const ORDER_COLUMNS: Record<SupplierOrderBy, AnyColumn> = {
	name: suppliers.name,
	type: suppliers.type,
	createdAt: suppliers.createdAt,
	updatedAt: suppliers.updatedAt
};

/**
 * Get all suppliers (excluding soft-deleted by default)
 *
 * @example
 * getAllSuppliers()                                                  // → Supplier[]
 * getAllSuppliers({ orderBy: 'createdAt', limit: 10 })              // → Supplier[]
 * getAllSuppliers({ columns: { id: suppliers.id, name: suppliers.name } }) // → { id, name }[]
 */
export async function getAllSuppliers<T extends SelectedFields>(
	query: GetSuppliersQuery<T>
): Promise<InferSelectedRow<T>[]>;
export async function getAllSuppliers(options?: GetSuppliersOptions): Promise<Supplier[]>;
export async function getAllSuppliers<T extends SelectedFields>(
	optionsOrQuery?: GetSuppliersOptions | GetSuppliersQuery<T>
): Promise<Supplier[] | InferSelectedRow<T>[]> {
	const columns =
		optionsOrQuery && 'columns' in optionsOrQuery ? optionsOrQuery.columns : undefined;
	const opts = optionsOrQuery ?? {};

	// Build WHERE
	const whereClause = opts.includeDeleted ? undefined : isNull(suppliers.deletedAt);

	// Build ORDER BY
	const orderFn = opts.orderSort === 'desc' ? desc : asc;
	const orderClause = opts.orderBy ? orderFn(ORDER_COLUMNS[opts.orderBy]) : undefined;

	// Build query with $dynamic() to allow conditional chaining
	const base = columns
		? db.select(columns).from(suppliers).$dynamic()
		: db.select().from(suppliers).$dynamic();

	if (whereClause) base.where(whereClause);
	if (orderClause) base.orderBy(orderClause);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);
	return await base;
}

/**
 * Find a supplier by ID
 * @param deleted - If true, also matches soft-deleted suppliers (default: false)
 */
export async function findSupplierById(
	id: string,
	{ deleted }: { deleted?: boolean } = {}
): Promise<Supplier | null> {
	const filter = deleted
		? eq(suppliers.id, id)
		: and(eq(suppliers.id, id), isNull(suppliers.deletedAt));
	const [supplier] = await db.select().from(suppliers).where(filter);
	return supplier ?? null;
}

/**
 * Find a supplier by name (case-insensitive)
 * @param deleted - If true, matches only soft-deleted suppliers. If false (default), matches only active suppliers.
 */
export async function findSupplierByName(
	name: string,
	{ deleted = false }: { deleted?: boolean } = {}
): Promise<Supplier | null> {
	const deletedFilter = deleted ? isNotNull(suppliers.deletedAt) : isNull(suppliers.deletedAt);
	const [supplier] = await db
		.select()
		.from(suppliers)
		.where(and(ilike(suppliers.name, name), deletedFilter));
	return supplier ?? null;
}

// TODO: Add option to include deleted if needed in the future
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

/**
 * Restore a soft-deleted supplier with new data
 */
export async function restoreSupplier(id: string): Promise<Supplier> {
	const [supplier] = await db
		.update(suppliers)
		.set({
			deletedAt: null,
			updatedAt: new Date()
		})
		.where(eq(suppliers.id, id))
		.returning();
	return supplier;
}
