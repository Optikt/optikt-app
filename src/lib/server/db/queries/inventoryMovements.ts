import {
	eq,
	and,
	or,
	inArray,
	desc,
	asc,
	count,
	gte,
	lte,
	sql,
	type SQL,
	type SQLWrapper,
	type AnyColumn
} from 'drizzle-orm';
import { db } from '$lib/server/db';
import { buildTokenSearchConditions, relevanceScoreOrderSql } from '$lib/server/db/search';
import {
	inventoryMovements,
	inventoryLots,
	products,
	lensCatalogItems,
	purchaseOrders,
	sales,
	users,
	type NewInventoryMovement
} from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { MovementReferenceType } from '$lib/shared/enums';
import { fromISODate, toEndOfDay, toUTCString } from '$lib/dates';

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
	search?: string;
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
	if (opts.dateFrom) conditions.push(gte(inventoryMovements.createdAt, opts.dateFrom));
	if (opts.dateTo) {
		// dateTo is inclusive - include the entire day
		conditions.push(
			lte(inventoryMovements.createdAt, toUTCString(toEndOfDay(fromISODate(opts.dateTo)!)))
		);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

function movementSearchConcat(): SQL {
	return sql`concat(
		coalesce(${products.name}, ''), ' ',
		coalesce(${products.sku}, ''), ' ',
		coalesce(${lensCatalogItems.name}, ''), ' ',
		coalesce(${lensCatalogItems.type}, ''), ' ',
		coalesce(${users.fullName}, ''), ' ',
		coalesce(${inventoryMovements.notes}, ''), ' ',
		coalesce(CAST(${inventoryLots.lotNumber} AS TEXT), ''), ' ',
		coalesce(CONCAT('L-', LPAD(CAST(${inventoryLots.lotNumber} AS TEXT), 4, '0')), ''), ' ',
		coalesce(CAST(${purchaseOrders.orderNumber} AS TEXT), ''), ' ',
		coalesce(CONCAT('PO-', LPAD(CAST(${purchaseOrders.orderNumber} AS TEXT), 4, '0')), ''), ' ',
		coalesce(CAST(${sales.orderNumber} AS TEXT), ''), ' ',
		coalesce(CONCAT('#', LPAD(CAST(${sales.orderNumber} AS TEXT), 4, '0')), '')
	)`;
}

function movementSearchFields(): SQLWrapper[] {
	return [
		products.name,
		products.sku,
		lensCatalogItems.name,
		lensCatalogItems.type,
		users.fullName,
		inventoryMovements.notes,
		sql`cast(${inventoryLots.lotNumber} as text)`,
		sql`concat('L-', lpad(cast(${inventoryLots.lotNumber} as text), 4, '0'))`,
		sql`cast(${purchaseOrders.orderNumber} as text)`,
		sql`concat('PO-', lpad(cast(${purchaseOrders.orderNumber} as text), 4, '0'))`,
		sql`cast(${sales.orderNumber} as text)`,
		sql`concat('#', lpad(cast(${sales.orderNumber} as text), 4, '0'))`
	];
}

function buildMovementSearchCondition(search?: string): SQL | undefined {
	const value = search?.trim();
	if (!value) return undefined;

	const conditions = buildTokenSearchConditions(value, movementSearchConcat());
	return conditions.length > 0 ? and(...conditions) : undefined;
}

function combineMovementFilters(opts: MovementFilterOptions): SQL | undefined {
	const baseWhere = buildMovementConditions(opts);
	const searchWhere = buildMovementSearchCondition(opts.search);

	if (baseWhere && searchWhere) {
		return and(baseWhere, searchWhere);
	}

	return baseWhere ?? searchWhere;
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
	const where = combineMovementFilters(options ?? {});
	const base = db
		.select({ value: count() })
		.from(inventoryMovements)
		.leftJoin(inventoryLots, eq(inventoryMovements.lotId, inventoryLots.id))
		.leftJoin(products, eq(inventoryMovements.productId, products.id))
		.leftJoin(lensCatalogItems, eq(inventoryMovements.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(users, eq(inventoryMovements.createdById, users.id))
		.leftJoin(
			purchaseOrders,
			and(
				eq(inventoryMovements.referenceType, MovementReferenceType.PURCHASE_ORDER),
				eq(inventoryMovements.referenceId, purchaseOrders.id)
			)
		)
		.leftJoin(
			sales,
			and(
				eq(inventoryMovements.referenceType, MovementReferenceType.SALE),
				eq(inventoryMovements.referenceId, sales.id)
			)
		)
		.$dynamic();
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

export async function getPurchaseOrderRelatedMovements(
	purchaseOrderId: string,
	lotIds: string[] = []
) {
	const conditions: SQL[] = [
		and(
			eq(inventoryMovements.referenceType, MovementReferenceType.PURCHASE_ORDER),
			eq(inventoryMovements.referenceId, purchaseOrderId)
		)!
	];

	if (lotIds.length > 0) {
		conditions.push(
			and(
				inArray(inventoryMovements.lotId, lotIds),
				eq(inventoryMovements.referenceType, MovementReferenceType.MANUAL_ADJUSTMENT)
			)!
		);
	}

	return db
		.select()
		.from(inventoryMovements)
		.where(or(...conditions))
		.orderBy(desc(inventoryMovements.createdAt));
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
	const where = combineMovementFilters(opts);

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
			lensName: lensCatalogItems.name,
			lensType: lensCatalogItems.type,
			itemName: sql<string | null>`COALESCE(${products.name}, ${lensCatalogItems.name})`,
			itemCode: sql<string | null>`COALESCE(${products.sku}, ${lensCatalogItems.type}::text)`,
			quantityDelta: inventoryMovements.quantityDelta,
			quantityBefore: inventoryMovements.quantityBefore,
			quantityAfter: inventoryMovements.quantityAfter,
			referenceType: inventoryMovements.referenceType,
			referenceId: inventoryMovements.referenceId,
			purchaseOrderNumber: purchaseOrders.orderNumber,
			saleOrderNumber: sales.orderNumber,
			referenceCode: sql<string | null>`CASE
				WHEN ${purchaseOrders.orderNumber} IS NOT NULL THEN CONCAT('PO-', LPAD(CAST(${purchaseOrders.orderNumber} AS TEXT), 4, '0'))
				WHEN ${sales.orderNumber} IS NOT NULL THEN CONCAT('#', LPAD(CAST(${sales.orderNumber} AS TEXT), 4, '0'))
				ELSE NULL
			END`,
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
		.leftJoin(lensCatalogItems, eq(inventoryMovements.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(
			purchaseOrders,
			and(
				eq(inventoryMovements.referenceType, MovementReferenceType.PURCHASE_ORDER),
				eq(inventoryMovements.referenceId, purchaseOrders.id)
			)
		)
		.leftJoin(
			sales,
			and(
				eq(inventoryMovements.referenceType, MovementReferenceType.SALE),
				eq(inventoryMovements.referenceId, sales.id)
			)
		)
		.leftJoin(users, eq(inventoryMovements.createdById, users.id))
		.$dynamic();

	if (where) base.where(where);
	const orderByColumns: SQL[] = [];
	if (opts.search) {
		orderByColumns.push(relevanceScoreOrderSql(opts.search.trim(), movementSearchFields()));
	}
	orderByColumns.push(orderClause);
	if (orderByColumns.length > 0) base.orderBy(...orderByColumns);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	return base;
}
