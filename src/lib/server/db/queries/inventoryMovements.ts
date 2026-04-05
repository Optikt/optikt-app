import { eq, and, desc, asc, count, gte, lte, type SQL, type AnyColumn } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	inventoryMovements,
	inventoryLots,
	products,
	users,
	type NewInventoryMovement
} from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MovementOrderBy = 'createdAt';

export interface MovementFilterOptions {
	lotId?: string;
	productId?: string;
	lensCatalogItemId?: string;
	movementType?: string;
	referenceType?: string;
	referenceId?: string;
	dateFrom?: string;
	dateTo?: string;
}

export interface GetMovementsOptions extends MovementFilterOptions {
	orderBy?: MovementOrderBy;
	orderSort?: 'asc' | 'desc';
	limit?: number;
	offset?: number;
}

const ORDER_COLUMNS: Record<MovementOrderBy, AnyColumn> = {
	createdAt: inventoryMovements.createdAt
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildMovementConditions(opts: MovementFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (opts.lotId) conditions.push(eq(inventoryMovements.lotId, opts.lotId));
	if (opts.productId) conditions.push(eq(inventoryMovements.productId, opts.productId));
	if (opts.lensCatalogItemId)
		conditions.push(eq(inventoryMovements.lensCatalogItemId, opts.lensCatalogItemId));
	if (opts.movementType) conditions.push(eq(inventoryMovements.movementType, opts.movementType));
	if (opts.referenceType) conditions.push(eq(inventoryMovements.referenceType, opts.referenceType));
	if (opts.referenceId) conditions.push(eq(inventoryMovements.referenceId, opts.referenceId));
	if (opts.dateFrom) conditions.push(gte(inventoryMovements.createdAt, new Date(opts.dateFrom)));
	if (opts.dateTo) {
		// dateTo is inclusive — include the entire day
		const endOfDay = new Date(opts.dateTo);
		endOfDay.setDate(endOfDay.getDate() + 1);
		conditions.push(lte(inventoryMovements.createdAt, endOfDay));
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Create a single immutable inventory movement record.
 * Must be called inside a transaction.
 */
export async function createInventoryMovement(data: NewInventoryMovement, executor: DbOrTx = db) {
	const [movement] = await executor.insert(inventoryMovements).values(data).returning();
	return movement;
}

/**
 * List inventory movements with optional filters and pagination.
 */
export async function getInventoryMovements(options?: GetMovementsOptions) {
	const opts = options ?? {};
	const where = buildMovementConditions(opts);

	const orderFn = opts.orderSort === 'asc' ? asc : desc;
	const orderClause = opts.orderBy
		? orderFn(ORDER_COLUMNS[opts.orderBy])
		: desc(inventoryMovements.createdAt);

	const base = db.select().from(inventoryMovements).$dynamic();

	if (where) base.where(where);
	base.orderBy(orderClause);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	return base;
}

/**
 * Count movements matching the given filters.
 */
export async function countInventoryMovements(options?: MovementFilterOptions): Promise<number> {
	const where = buildMovementConditions(options ?? {});
	const base = db.select({ value: count() }).from(inventoryMovements).$dynamic();
	if (where) base.where(where);
	const [result] = await base;
	return result.value;
}

/**
 * Get all movements for a specific lot, ordered chronologically.
 */
export async function getMovementsByLotId(lotId: string) {
	return db
		.select()
		.from(inventoryMovements)
		.where(eq(inventoryMovements.lotId, lotId))
		.orderBy(asc(inventoryMovements.createdAt));
}

/**
 * Get all movements for a specific reference (e.g. all movements from a sale or PO).
 */
export async function getMovementsByReference(referenceType: string, referenceId: string) {
	return db
		.select()
		.from(inventoryMovements)
		.where(
			and(
				eq(inventoryMovements.referenceType, referenceType),
				eq(inventoryMovements.referenceId, referenceId)
			)
		)
		.orderBy(asc(inventoryMovements.createdAt));
}

// ---------------------------------------------------------------------------
// Rich queries (with joins for display)
// ---------------------------------------------------------------------------

/**
 * Movement with joined product name, lot number, and user name for display.
 */
export type MovementWithDetails = Awaited<ReturnType<typeof getMovementsWithDetails>>[number];

/**
 * List movements with product, lot, and user details for display.
 * Same filtering as getInventoryMovements but includes joined data.
 */
export async function getMovementsWithDetails(options?: GetMovementsOptions) {
	const opts = options ?? {};
	const where = buildMovementConditions(opts);

	const orderFn = opts.orderSort === 'asc' ? asc : desc;
	const orderClause = opts.orderBy
		? orderFn(ORDER_COLUMNS[opts.orderBy])
		: desc(inventoryMovements.createdAt);

	const base = db
		.select({
			id: inventoryMovements.id,
			movementType: inventoryMovements.movementType,
			lotId: inventoryMovements.lotId,
			lotNumber: inventoryLots.lotNumber,
			itemType: inventoryMovements.itemType,
			productId: inventoryMovements.productId,
			productName: products.name,
			productSku: products.sku,
			lensCatalogItemId: inventoryMovements.lensCatalogItemId,
			quantityDelta: inventoryMovements.quantityDelta,
			quantityBefore: inventoryMovements.quantityBefore,
			quantityAfter: inventoryMovements.quantityAfter,
			referenceType: inventoryMovements.referenceType,
			referenceId: inventoryMovements.referenceId,
			notes: inventoryMovements.notes,
			unitCostAtAdjustment: inventoryMovements.unitCostAtAdjustment,
			totalCostAtAdjustment: inventoryMovements.totalCostAtAdjustment,
			adjustmentReportCategory: inventoryMovements.adjustmentReportCategory,
			createdById: inventoryMovements.createdById,
			createdByName: users.fullName,
			createdAt: inventoryMovements.createdAt
		})
		.from(inventoryMovements)
		.leftJoin(inventoryLots, eq(inventoryMovements.lotId, inventoryLots.id))
		.leftJoin(products, eq(inventoryMovements.productId, products.id))
		.leftJoin(users, eq(inventoryMovements.createdById, users.id))
		.$dynamic();

	if (where) base.where(where);
	base.orderBy(orderClause);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	return base;
}
