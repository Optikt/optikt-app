/**
 * Materials database queries
 */
import {
	eq,
	isNull,
	and,
	ilike,
	isNotNull,
	or,
	count,
	asc,
	desc,
	type SQL,
	type AnyColumn
} from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { materials, type Material, type NewMaterial } from '$lib/server/db/schema';
import type { DbOrTx, InferSelectedRow } from '$lib/server/db/types';
import { nowISO } from '$lib/dates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Sortable material columns */
export type MaterialOrderBy = 'name' | 'code' | 'productType' | 'createdAt' | 'updatedAt';

/** Filter options for materials listing */
export interface MaterialFilterOptions {
	/** Search by name or code (case-insensitive) */
	search?: string;
	/** Filter by product type */
	productType?: string;
	/** Include inactive materials (default: false - active only) */
	includeInactive?: boolean;
}

/** Options for querying materials */
export interface GetMaterialsOptions extends MaterialFilterOptions {
	/** Include soft-deleted materials (default: false) */
	includeDeleted?: boolean;
	/** Column to order by */
	orderBy?: MaterialOrderBy;
	/** Sort direction (default: 'asc') */
	orderSort?: 'asc' | 'desc';
	/** Maximum number of results to return */
	limit?: number;
	/** Number of results to skip (for pagination) */
	offset?: number;
}

/** Query with column projection */
export interface GetMaterialsQuery<
	T extends SelectedFields = SelectedFields
> extends GetMaterialsOptions {
	columns: T;
}

// ---------------------------------------------------------------------------
// Column map for orderBy
// ---------------------------------------------------------------------------

const ORDER_COLUMNS: Record<MaterialOrderBy, AnyColumn> = {
	name: materials.name,
	code: materials.code,
	productType: materials.productType,
	createdAt: materials.createdAt,
	updatedAt: materials.updatedAt
};

// ---------------------------------------------------------------------------
// Shared condition builder
// ---------------------------------------------------------------------------

/**
 * Build WHERE conditions from filter/query options.
 * Returns undefined when no conditions apply.
 */
function buildMaterialConditions(opts: GetMaterialsOptions): SQL | undefined {
	const conditions: SQL[] = [];

	// Soft-delete
	if (!opts.includeDeleted) {
		conditions.push(isNull(materials.deletedAt));
	}

	// Active/inactive
	if (!opts.includeInactive) {
		conditions.push(eq(materials.isActive, true));
	}

	// Product type
	if (opts.productType) {
		conditions.push(eq(materials.productType, opts.productType));
	}

	// Search
	if (opts.search) {
		const pattern = `%${opts.search}%`;
		conditions.push(or(ilike(materials.name, pattern), ilike(materials.code, pattern))!);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all materials (excluding soft-deleted and inactive by default)
 *
 * @example
 * getAllMaterials()                                                           // → Material[]
 * getAllMaterials({ orderBy: 'createdAt', limit: 10 })                        // → Material[]
 * getAllMaterials({ productType: 'FRAME' })                                   // → Material[]
 * getAllMaterials({ columns: { id: materials.id, name: materials.name } })    // → { id, name }[]
 */
export async function getAllMaterials<T extends SelectedFields>(
	query: GetMaterialsQuery<T>
): Promise<InferSelectedRow<T>[]>;
export async function getAllMaterials(options?: GetMaterialsOptions): Promise<Material[]>;
export async function getAllMaterials<T extends SelectedFields>(
	optionsOrQuery?: GetMaterialsOptions | GetMaterialsQuery<T>
): Promise<Material[] | InferSelectedRow<T>[]> {
	const columns =
		optionsOrQuery && 'columns' in optionsOrQuery ? optionsOrQuery.columns : undefined;
	const opts = optionsOrQuery ?? {};

	const whereClause = buildMaterialConditions(opts);
	const orderFn = opts.orderSort === 'desc' ? desc : asc;
	const orderClause = opts.orderBy ? orderFn(ORDER_COLUMNS[opts.orderBy]) : asc(materials.name);

	const base = columns
		? db.select(columns).from(materials).$dynamic()
		: db.select().from(materials).$dynamic();

	if (whereClause) base.where(whereClause);
	base.orderBy(orderClause);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);
	return await base;
}

/**
 * Count materials matching the given filter options.
 * Useful for pagination totals without fetching full rows.
 */
export async function countMaterials(
	options?: MaterialFilterOptions & { includeDeleted?: boolean }
): Promise<number> {
	const opts = options ?? {};
	const whereClause = buildMaterialConditions(opts);
	const base = db.select({ count: count() }).from(materials).$dynamic();
	if (whereClause) base.where(whereClause);
	const [result] = await base;
	return result?.count ?? 0;
}

/**
 * Find a material by ID
 * @param deleted - 'exclude' (default): only active | 'include': active + deleted | 'only': only deleted
 */
export async function findMaterialById(
	id: string,
	{ deleted = 'exclude' }: { deleted?: 'exclude' | 'include' | 'only' } = {}
): Promise<Material | null> {
	const conditions: SQL[] = [eq(materials.id, id)];
	if (deleted === 'exclude') conditions.push(isNull(materials.deletedAt));
	if (deleted === 'only') conditions.push(isNotNull(materials.deletedAt));
	const [material] = await db
		.select()
		.from(materials)
		.where(and(...conditions));
	return material ?? null;
}

/**
 * Find a material by name and optional product type (case-insensitive)
 * @param deleted - 'exclude' (default): only active | 'only': only deleted
 */
export async function findMaterialByName(
	name: string,
	productType?: string,
	{ deleted = 'exclude' }: { deleted?: 'exclude' | 'only' } = {}
): Promise<Material | null> {
	const conditions: SQL[] = [ilike(materials.name, name)];
	if (deleted === 'exclude') conditions.push(isNull(materials.deletedAt));
	if (deleted === 'only') conditions.push(isNotNull(materials.deletedAt));
	if (productType) conditions.push(eq(materials.productType, productType));
	const [material] = await db
		.select()
		.from(materials)
		.where(and(...conditions));
	return material ?? null;
}

/**
 * Create a new material
 */
export async function createMaterial(
	data: Omit<NewMaterial, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Material> {
	const now = nowISO();
	const [material] = await db
		.insert(materials)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return material;
}

/**
 * Update a material by ID
 */
export async function updateMaterial(
	id: string,
	data: Partial<Omit<Material, 'id' | 'createdAt'>>
): Promise<Material | null> {
	const [material] = await db
		.update(materials)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(materials.id, id))
		.returning();
	return material ?? null;
}

/**
 * Soft delete a material by ID
 */
export async function deleteMaterial(id: string): Promise<boolean> {
	const result = await db
		.update(materials)
		.set({ deletedAt: nowISO(), updatedAt: nowISO() })
		.where(eq(materials.id, id));
	return result.count > 0;
}

/**
 * Restore a soft-deleted material
 */
export async function restoreMaterial(id: string): Promise<Material> {
	const [material] = await db
		.update(materials)
		.set({
			deletedAt: null,
			isActive: true,
			updatedAt: nowISO()
		})
		.where(eq(materials.id, id))
		.returning();
	return material;
}

/**
 * Resolve a pending material inside a transaction.
 * Looks up by name + productType (case-insensitive); creates if not found.
 * Returns the resolved material ID.
 */
export async function resolvePendingMaterial(
	pendingName: string,
	productType: string,
	now: string,
	executor: DbOrTx = db
): Promise<string> {
	const [existing] = await executor
		.select()
		.from(materials)
		.where(
			and(
				ilike(materials.name, pendingName),
				eq(materials.productType, productType),
				isNull(materials.deletedAt)
			)
		);

	if (existing) return existing.id;

	const code = pendingName.substring(0, 10).toUpperCase().replace(/\s+/g, '_');
	const [created] = await executor
		.insert(materials)
		.values({
			id: crypto.randomUUID(),
			name: pendingName,
			code,
			productType,
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return created.id;
}
