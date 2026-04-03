import { eq, and, asc, desc, gt, count, sql, type SQL, type AnyColumn } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	inventoryLots,
	inventoryMovements,
	products,
	type InventoryLot,
	type NewInventoryLot
} from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LotOrderBy = 'lotNumber' | 'createdAt' | 'quantityAvailable';

export interface LotFilterOptions {
	productId?: string;
	lensCatalogItemId?: string;
	isActive?: boolean;
}

export interface GetLotsOptions extends LotFilterOptions {
	orderBy?: LotOrderBy;
	orderSort?: 'asc' | 'desc';
	limit?: number;
	offset?: number;
}

const ORDER_COLUMNS: Record<LotOrderBy, AnyColumn> = {
	lotNumber: inventoryLots.lotNumber,
	createdAt: inventoryLots.createdAt,
	quantityAvailable: inventoryLots.quantityAvailable
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildLotConditions(opts: LotFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (opts.productId) conditions.push(eq(inventoryLots.productId, opts.productId));
	if (opts.lensCatalogItemId)
		conditions.push(eq(inventoryLots.lensCatalogItemId, opts.lensCatalogItemId));
	if (opts.isActive !== undefined) conditions.push(eq(inventoryLots.isActive, opts.isActive));

	return conditions.length > 0 ? and(...conditions) : undefined;
}

// ---------------------------------------------------------------------------
// Sequential lot number
// ---------------------------------------------------------------------------

/**
 * Get the next lot number (max + 1). Must be called inside a transaction.
 */
export async function getNextLotNumber(executor: DbOrTx = db): Promise<number> {
	const [result] = await executor
		.select({ maxNum: sql<number>`coalesce(max(${inventoryLots.lotNumber}), 0)` })
		.from(inventoryLots);
	return result.maxNum + 1;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a single inventory lot. Must be called inside a transaction.
 */
export async function createInventoryLot(
	data: NewInventoryLot,
	executor: DbOrTx = db
): Promise<InventoryLot> {
	const [lot] = await executor.insert(inventoryLots).values(data).returning();
	return lot;
}

/**
 * Find a lot by ID.
 */
export async function findLotById(id: string, executor: DbOrTx = db): Promise<InventoryLot | null> {
	const [lot] = await executor.select().from(inventoryLots).where(eq(inventoryLots.id, id));
	return lot ?? null;
}

/**
 * List inventory lots with optional filters and pagination.
 */
export async function getInventoryLots(options?: GetLotsOptions) {
	const opts = options ?? {};
	const where = buildLotConditions(opts);

	const orderFn = opts.orderSort === 'desc' ? desc : asc;
	const orderClause = opts.orderBy
		? orderFn(ORDER_COLUMNS[opts.orderBy])
		: asc(inventoryLots.createdAt);

	const base = db.select().from(inventoryLots).$dynamic();

	if (where) base.where(where);
	base.orderBy(orderClause);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	return base;
}

/**
 * Count lots matching the given filters.
 */
export async function countInventoryLots(options?: LotFilterOptions): Promise<number> {
	const where = buildLotConditions(options ?? {});
	const base = db.select({ value: count() }).from(inventoryLots).$dynamic();
	if (where) base.where(where);
	const [result] = await base;
	return result.value;
}

// ---------------------------------------------------------------------------
// FIFO: find the oldest lot with available stock
// ---------------------------------------------------------------------------

/**
 * Get active lots for a product in FIFO order (oldest first).
 * Used during sale creation to find which lot to consume from.
 */
export async function getActiveLotsFifo(
	productId: string,
	executor: DbOrTx = db
): Promise<InventoryLot[]> {
	return executor
		.select()
		.from(inventoryLots)
		.where(
			and(
				eq(inventoryLots.productId, productId),
				eq(inventoryLots.isActive, true),
				gt(inventoryLots.quantityAvailable, 0)
			)
		)
		.orderBy(asc(inventoryLots.createdAt));
}

/**
 * Same as getActiveLotsFifo but for lens catalog items.
 */
export async function getActiveLensLotsFifo(
	lensCatalogItemId: string,
	executor: DbOrTx = db
): Promise<InventoryLot[]> {
	return executor
		.select()
		.from(inventoryLots)
		.where(
			and(
				eq(inventoryLots.lensCatalogItemId, lensCatalogItemId),
				eq(inventoryLots.isActive, true),
				gt(inventoryLots.quantityAvailable, 0)
			)
		)
		.orderBy(asc(inventoryLots.createdAt));
}

// ---------------------------------------------------------------------------
// Stock mutations (called inside transactions)
// ---------------------------------------------------------------------------

/**
 * Consume quantity from a lot (sale or adjustment out).
 * Updates quantityAvailable and sets isActive=false when depleted.
 * Returns the updated lot.
 */
export async function consumeFromLot(
	lotId: string,
	quantity: number,
	executor: DbOrTx = db
): Promise<InventoryLot> {
	const lot = await findLotById(lotId, executor);
	if (!lot) throw new Error(`Lot ${lotId} not found`);
	if (lot.quantityAvailable < quantity) {
		throw new Error(
			`Stock insuficiente en lote ${lot.lotNumber}. Disponible: ${lot.quantityAvailable}, solicitado: ${quantity}`
		);
	}

	const newAvailable = lot.quantityAvailable - quantity;
	const [updated] = await executor
		.update(inventoryLots)
		.set({
			quantityAvailable: newAvailable,
			isActive: newAvailable > 0,
			updatedAt: new Date()
		})
		.where(eq(inventoryLots.id, lotId))
		.returning();
	return updated;
}

/**
 * Return quantity to a lot (sale cancellation or adjustment in).
 * Updates quantityAvailable and reactivates the lot if needed.
 * Returns the updated lot.
 */
export async function returnToLot(
	lotId: string,
	quantity: number,
	executor: DbOrTx = db
): Promise<InventoryLot> {
	const lot = await findLotById(lotId, executor);
	if (!lot) throw new Error(`Lot ${lotId} not found`);

	const newAvailable = lot.quantityAvailable + quantity;
	const [updated] = await executor
		.update(inventoryLots)
		.set({
			quantityAvailable: newAvailable,
			isActive: true,
			updatedAt: new Date()
		})
		.where(eq(inventoryLots.id, lotId))
		.returning();
	return updated;
}

/**
 * Apply a manual inventory adjustment to a specific lot.
 * Creates the movement record and updates the lot + product cached stock.
 * Must be called inside a transaction.
 *
 * @param quantityDelta - positive for ADJUSTMENT_IN, negative for ADJUSTMENT_OUT
 */
export async function applyManualAdjustment(
	params: {
		lotId: string;
		quantityDelta: number;
		notes: string;
		createdById: string;
	},
	executor: DbOrTx = db
) {
	const { lotId, quantityDelta, notes, createdById } = params;
	if (!notes.trim()) throw new Error('El motivo del ajuste es obligatorio');

	const lot = await findLotById(lotId, executor);
	if (!lot) throw new Error(`Lot ${lotId} not found`);

	const movementType =
		quantityDelta > 0 ? InventoryMovementType.ADJUSTMENT_IN : InventoryMovementType.ADJUSTMENT_OUT;

	const quantityBefore = lot.quantityAvailable;
	const quantityAfter = quantityBefore + quantityDelta;

	if (quantityAfter < 0) {
		throw new Error(
			`Ajuste inválido: disponible ${quantityBefore}, delta ${quantityDelta} resultaría en ${quantityAfter}`
		);
	}

	// Update lot
	await executor
		.update(inventoryLots)
		.set({
			quantityAvailable: quantityAfter,
			isActive: quantityAfter > 0,
			updatedAt: new Date()
		})
		.where(eq(inventoryLots.id, lotId));

	// Create movement
	const [movement] = await executor
		.insert(inventoryMovements)
		.values({
			movementType,
			lotId,
			itemType: lot.itemType,
			productId: lot.productId,
			lensCatalogItemId: lot.lensCatalogItemId,
			quantityDelta,
			quantityBefore,
			quantityAfter,
			referenceType: MovementReferenceType.MANUAL_ADJUSTMENT,
			referenceId: lotId, // self-reference for manual adjustments
			notes,
			createdById
		})
		.returning();

	// Update cached stock on product/lens
	if (lot.productId) {
		await executor
			.update(products)
			.set({
				stock: sql`${products.stock} + ${quantityDelta}`,
				updatedAt: new Date()
			})
			.where(eq(products.id, lot.productId));
	}

	return { lot: { ...lot, quantityAvailable: quantityAfter }, movement };
}
