import { eq, and, isNull, asc, desc, count, sql, type SQL, type AnyColumn } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	purchaseOrders,
	purchaseOrderItems,
	inventoryLots,
	inventoryMovements,
	products,
	lensCatalogItems,
	suppliers,
	users,
	type PurchaseOrder,
	type NewPurchaseOrder,
	type PurchaseOrderItem,
	type NewPurchaseOrderItem
} from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { PurchaseOrderStatus, PurchaseOrderItemType } from '$lib/shared/enums';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';
import { getNextLotNumber, getNextFifoCost } from './inventoryLots';
import { nowISO } from '$lib/dates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PurchaseOrderWithRelations = PurchaseOrder & {
	supplier: { id: string; name: string } | null;
	createdBy: { id: string; fullName: string } | null;
	confirmedBy: { id: string; fullName: string } | null;
};

export type PurchaseOrderItemWithProduct = PurchaseOrderItem & {
	product: { id: string; name: string; sku: string } | null;
};

export type PurchaseOrderOrderBy = 'orderNumber' | 'orderDate' | 'createdAt' | 'status';

export interface PurchaseOrderFilterOptions {
	includeDeleted?: boolean;
	status?: string;
	supplierId?: string;
}

export interface GetPurchaseOrdersOptions extends PurchaseOrderFilterOptions {
	orderBy?: PurchaseOrderOrderBy;
	orderSort?: 'asc' | 'desc';
	limit?: number;
	offset?: number;
}

const ORDER_COLUMNS: Record<PurchaseOrderOrderBy, AnyColumn> = {
	orderNumber: purchaseOrders.orderNumber,
	orderDate: purchaseOrders.orderDate,
	createdAt: purchaseOrders.createdAt,
	status: purchaseOrders.status
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildPOConditions(opts: PurchaseOrderFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (!opts.includeDeleted) conditions.push(isNull(purchaseOrders.deletedAt));
	if (opts.status) conditions.push(eq(purchaseOrders.status, opts.status));
	if (opts.supplierId) conditions.push(eq(purchaseOrders.supplierId, opts.supplierId));

	return conditions.length > 0 ? and(...conditions) : undefined;
}

// ---------------------------------------------------------------------------
// Sequential order number
// ---------------------------------------------------------------------------

export async function getNextPONumber(executor: DbOrTx = db): Promise<number> {
	const [result] = await executor
		.select({ maxNum: sql<number>`coalesce(max(${purchaseOrders.orderNumber}), 0)` })
		.from(purchaseOrders);
	return result.maxNum + 1;
}

// ---------------------------------------------------------------------------
// CRUD — Purchase Orders
// ---------------------------------------------------------------------------

export async function createPurchaseOrder(
	data: NewPurchaseOrder,
	executor: DbOrTx = db
): Promise<PurchaseOrder> {
	const [po] = await executor.insert(purchaseOrders).values(data).returning();
	return po;
}

export async function findPurchaseOrderById(
	id: string,
	executor: DbOrTx = db
): Promise<PurchaseOrder | null> {
	const [po] = await executor.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
	return po ?? null;
}

export async function findPurchaseOrderByIdWithRelations(
	id: string
): Promise<PurchaseOrderWithRelations | null> {
	const createdByUsers = users;
	// Alias for confirmed_by user — use a subquery approach instead
	const results = await db
		.select({
			po: purchaseOrders,
			supplier: { id: suppliers.id, name: suppliers.name },
			createdBy: {
				id: createdByUsers.id,
				fullName: createdByUsers.fullName
			}
		})
		.from(purchaseOrders)
		.leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
		.leftJoin(createdByUsers, eq(purchaseOrders.createdById, createdByUsers.id))
		.where(eq(purchaseOrders.id, id));

	if (results.length === 0) return null;

	const r = results[0];
	return {
		...r.po,
		supplier: r.supplier?.id ? r.supplier : null,
		createdBy: r.createdBy?.id ? r.createdBy : null,
		confirmedBy: null // loaded separately if needed
	};
}

export async function updatePurchaseOrder(
	id: string,
	data: Partial<PurchaseOrder>,
	executor: DbOrTx = db
): Promise<PurchaseOrder> {
	const [po] = await executor
		.update(purchaseOrders)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(purchaseOrders.id, id))
		.returning();
	return po;
}

export async function softDeletePurchaseOrder(id: string, executor: DbOrTx = db): Promise<void> {
	await executor
		.update(purchaseOrders)
		.set({ deletedAt: nowISO(), updatedAt: nowISO() })
		.where(eq(purchaseOrders.id, id));
}

export async function getAllPurchaseOrders(
	options?: GetPurchaseOrdersOptions
): Promise<PurchaseOrderWithRelations[]> {
	const opts = options ?? {};
	const where = buildPOConditions(opts);

	const orderFn = opts.orderSort === 'desc' ? desc : asc;
	const orderClause = opts.orderBy
		? orderFn(ORDER_COLUMNS[opts.orderBy])
		: desc(purchaseOrders.orderDate);

	const base = db
		.select({
			po: purchaseOrders,
			supplier: { id: suppliers.id, name: suppliers.name },
			createdBy: { id: users.id, fullName: users.fullName }
		})
		.from(purchaseOrders)
		.leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
		.leftJoin(users, eq(purchaseOrders.createdById, users.id))
		.$dynamic();

	if (where) base.where(where);
	base.orderBy(orderClause);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	const results = await base;

	return results.map((r) => ({
		...r.po,
		supplier: r.supplier?.id ? r.supplier : null,
		createdBy: r.createdBy?.id ? r.createdBy : null,
		confirmedBy: null
	}));
}

export async function countPurchaseOrders(options?: PurchaseOrderFilterOptions): Promise<number> {
	const where = buildPOConditions(options ?? {});
	const base = db.select({ value: count() }).from(purchaseOrders).$dynamic();
	if (where) base.where(where);
	const [result] = await base;
	return result.value;
}

// ---------------------------------------------------------------------------
// CRUD — Purchase Order Items
// ---------------------------------------------------------------------------

export async function createPurchaseOrderItem(
	data: NewPurchaseOrderItem,
	executor: DbOrTx = db
): Promise<PurchaseOrderItem> {
	const [item] = await executor.insert(purchaseOrderItems).values(data).returning();
	return item;
}

export async function createPurchaseOrderItems(
	items: NewPurchaseOrderItem[],
	executor: DbOrTx = db
): Promise<PurchaseOrderItem[]> {
	if (items.length === 0) return [];
	return executor.insert(purchaseOrderItems).values(items).returning();
}

export async function getPurchaseOrderItems(
	purchaseOrderId: string,
	executor: DbOrTx = db
): Promise<PurchaseOrderItemWithProduct[]> {
	const results = await executor
		.select({
			item: purchaseOrderItems,
			product: { id: products.id, name: products.name, sku: products.sku }
		})
		.from(purchaseOrderItems)
		.leftJoin(products, eq(purchaseOrderItems.productId, products.id))
		.where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))
		.orderBy(asc(purchaseOrderItems.createdAt));

	return results.map((r) => ({
		...r.item,
		product: r.product?.id ? r.product : null
	}));
}

export async function updatePurchaseOrderItem(
	id: string,
	data: Partial<PurchaseOrderItem>,
	executor: DbOrTx = db
): Promise<PurchaseOrderItem> {
	const [item] = await executor
		.update(purchaseOrderItems)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(purchaseOrderItems.id, id))
		.returning();
	return item;
}

export async function deletePurchaseOrderItem(id: string, executor: DbOrTx = db): Promise<void> {
	await executor.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
}

// ---------------------------------------------------------------------------
// PO Confirmation — The core transaction
// ---------------------------------------------------------------------------

/**
 * Confirm a purchase order: creates lots + movements, updates stock.
 * Must be called inside db.transaction() by the caller.
 *
 * @param poId - Purchase order ID
 * @param confirmedById - User confirming the PO
 * @param tx - Transaction executor (required)
 */
export async function confirmPurchaseOrder(poId: string, confirmedById: string, tx: DbOrTx) {
	// 1. Validate PO is DRAFT
	const po = await findPurchaseOrderById(poId, tx);
	if (!po) throw new Error(`Orden de compra ${poId} no encontrada`);
	if (po.status !== PurchaseOrderStatus.DRAFT) {
		throw new Error(`No se puede confirmar: estado actual es ${po.status}`);
	}

	// 2. Get all items for this PO
	const items = await tx
		.select()
		.from(purchaseOrderItems)
		.where(eq(purchaseOrderItems.purchaseOrderId, poId));

	if (items.length === 0) {
		throw new Error('No se puede confirmar una orden sin ítems');
	}

	// 3. Process each item
	for (const item of items) {
		// a. Create inventory lot
		const lotNumber = await getNextLotNumber(tx);
		const [lot] = await tx
			.insert(inventoryLots)
			.values({
				lotNumber,
				purchaseOrderItemId: item.id,
				itemType: item.itemType,
				productId: item.productId,
				lensCatalogItemId: item.lensCatalogItemId,
				quantityInitial: item.quantity,
				quantityAvailable: item.quantity,
				unitPurchasePrice: item.unitPurchasePrice,
				unitSalePrice: item.unitSalePrice,
				bcvRateAtPurchase: po.bcvRate,
				isActive: true
			})
			.returning();

		// b. Link lot to PO item
		await tx
			.update(purchaseOrderItems)
			.set({ lotId: lot.id, updatedAt: nowISO() })
			.where(eq(purchaseOrderItems.id, item.id));

		// c. Create PURCHASE_IN movement
		await tx.insert(inventoryMovements).values({
			movementType: InventoryMovementType.PURCHASE_IN,
			lotId: lot.id,
			itemType: item.itemType,
			productId: item.productId,
			lensCatalogItemId: item.lensCatalogItemId,
			quantityDelta: item.quantity,
			quantityBefore: 0,
			quantityAfter: item.quantity,
			referenceType: MovementReferenceType.PURCHASE_ORDER,
			referenceId: po.id,
			createdById: confirmedById
		});

		// d. Update cached stock counter + FIFO-based current purchase price
		// NOTE: currentSalePrice is NOT updated here — it requires explicit user approval
		if (item.itemType === PurchaseOrderItemType.PRODUCT && item.productId) {
			const fifoCost = await getNextFifoCost(item.productId, tx);
			await tx
				.update(products)
				.set({
					stock: sql`${products.stock} + ${item.quantity}`,
					currentPurchasePrice: fifoCost ?? item.unitPurchasePrice,
					updatedAt: nowISO()
				})
				.where(eq(products.id, item.productId));
		} else if (item.itemType === PurchaseOrderItemType.LENS && item.lensCatalogItemId) {
			await tx
				.update(lensCatalogItems)
				.set({
					stock: sql`coalesce(${lensCatalogItems.stock}, 0) + ${item.quantity}`,
					updatedAt: nowISO()
				})
				.where(eq(lensCatalogItems.id, item.lensCatalogItemId));
		}
	}

	// 4. Update PO status
	const [confirmed] = await tx
		.update(purchaseOrders)
		.set({
			status: PurchaseOrderStatus.CONFIRMED,
			confirmedById,
			confirmedAt: nowISO(),
			updatedAt: nowISO()
		})
		.where(eq(purchaseOrders.id, poId))
		.returning();

	return confirmed;
}

// ---------------------------------------------------------------------------
// PO Cancellation (only DRAFT orders can be cancelled)
// ---------------------------------------------------------------------------

export async function cancelPurchaseOrder(
	poId: string,
	executor: DbOrTx = db
): Promise<PurchaseOrder> {
	const po = await findPurchaseOrderById(poId, executor);
	if (!po) throw new Error(`Orden de compra ${poId} no encontrada`);
	if (po.status !== PurchaseOrderStatus.DRAFT) {
		throw new Error(`Solo se pueden cancelar órdenes en estado DRAFT. Estado actual: ${po.status}`);
	}

	const [cancelled] = await executor
		.update(purchaseOrders)
		.set({
			status: PurchaseOrderStatus.CANCELLED,
			updatedAt: nowISO()
		})
		.where(eq(purchaseOrders.id, poId))
		.returning();

	return cancelled;
}
