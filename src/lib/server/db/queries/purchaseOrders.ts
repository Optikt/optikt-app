import {
	eq,
	and,
	isNull,
	asc,
	desc,
	count,
	inArray,
	gte,
	lt,
	sql,
	type SQL,
	type AnyColumn
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import {
	purchaseOrders,
	purchaseOrderItems,
	purchaseOrderPayments,
	purchaseOrderCreditSchedule,
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
import {
	PurchaseOrderStatus,
	PurchaseOrderItemType,
	PurchaseDiscountType,
	PurchasePaymentTerms
} from '$lib/shared/enums';
import { InventoryMovementType, MovementReferenceType } from '$lib/shared/enums';
import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus,
	type PurchaseOrderBalanceSummary,
	type PurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';
import { getNextLotNumber, getNextFifoCost } from './inventoryLots';
import { nowISO } from '$lib/dates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PurchaseOrderWithRelations = PurchaseOrder & {
	supplier: { id: string; name: string } | null;
	createdBy: { id: string; fullName: string } | null;
	confirmedBy: { id: string; fullName: string } | null;
	balance?: PurchaseOrderBalanceSummary;
	dueStatus?: PurchaseOrderDueStatus;
};

export type PurchaseOrderItemWithProduct = PurchaseOrderItem & {
	product: { id: string; name: string; sku: string; personalCode: string | null } | null;
	lensCatalogItem: { id: string; name: string; type: string } | null;
};

export type PurchaseOrderOrderBy = 'orderNumber' | 'orderDate' | 'createdAt' | 'status';

export interface PurchaseOrderFilterOptions {
	includeDeleted?: boolean;
	search?: string;
	status?: string;
	readyForReview?: boolean;
	supplierId?: string;
	/** When true, only return orders with a pending balance (not fully paid). */
	hasPendingBalance?: boolean;
	/** When true, only return confirmed credit orders with an overdue installment and balance. */
	hasOverdueBalance?: boolean;
}

export interface PurchaseOrderListStats {
	total: number;
	confirmed: number;
	draft: number;
	draftInProgress: number;
	draftReady: number;
	monthlySpend: number;
}

export interface PurchaseOrderItemDraftInput {
	id?: string;
	itemType: PurchaseOrderItemType;
	productId: string | null;
	lensCatalogItemId: string | null;
	quantity: number;
	unitPurchasePrice: number;
	unitSalePrice: number;
	appliesIva: boolean;
	ivaRate: number;
	/** Optional: client-side reviewed flag. Server resets to false when material fields change. */
	isReviewed?: boolean;
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

function buildPendingBalanceCondition(): SQL {
	return sql`
		COALESCE((
			SELECT SUM(pop.amount_usd_bcv)
			FROM ${purchaseOrderPayments} pop
			WHERE pop.purchase_order_id = ${purchaseOrders.id}
			  AND pop.voided_at IS NULL
		), 0)
		<
		ROUND(CAST(
			COALESCE((
				SELECT SUM(poi.quantity * poi.unit_purchase_price)
				FROM ${purchaseOrderItems} poi
				WHERE poi.purchase_order_id = ${purchaseOrders.id}
			), 0)
			*
			CASE
				WHEN ${purchaseOrders.settlementDiscountType} = 'NONE'
				  OR ${purchaseOrders.settlementDiscountValue} <= 0
				  THEN 1.0
				WHEN ${purchaseOrders.settlementDiscountType} = 'PERCENT'
				  THEN 1.0 - LEAST(${purchaseOrders.settlementDiscountValue}, 100.0) / 100.0
				ELSE
				  GREATEST(0.0, 1.0 - ${purchaseOrders.settlementDiscountValue} / NULLIF(
					COALESCE((
						SELECT SUM(poi2.quantity * poi2.unit_purchase_price)
						FROM ${purchaseOrderItems} poi2
						WHERE poi2.purchase_order_id = ${purchaseOrders.id}
					), 0), 0
				  ))
			END
		AS NUMERIC), 2) - 0.01
	`;
}

function buildOverdueBalanceCondition(): SQL {
	return sql`
		${purchaseOrders.status} = ${PurchaseOrderStatus.CONFIRMED}
		AND ${purchaseOrders.paymentTerms} = ${PurchasePaymentTerms.CREDIT}
		AND ${buildPendingBalanceCondition()}
		AND EXISTS (
			SELECT 1
			FROM ${purchaseOrderCreditSchedule} pocs
			WHERE pocs.purchase_order_id = ${purchaseOrders.id}
			  AND pocs.due_date < CURRENT_DATE
		)
	`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildPOConditions(opts: PurchaseOrderFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (!opts.includeDeleted) conditions.push(isNull(purchaseOrders.deletedAt));
	if (opts.search?.trim()) {
		const searchTerm = opts.search.trim();
		const pattern = `%${searchTerm}%`;
		conditions.push(sql`(
			cast(${purchaseOrders.orderNumber} as text) ilike ${pattern}
			or concat('PO-', lpad(cast(${purchaseOrders.orderNumber} as text), 4, '0')) ilike ${pattern}
			or coalesce(${purchaseOrders.invoiceNumber}, '') ilike ${pattern}
			or coalesce(${purchaseOrders.deliveryNoteNumber}, '') ilike ${pattern}
			or exists (
				select 1
				from ${suppliers}
				where ${suppliers.id} = ${purchaseOrders.supplierId}
					and ${suppliers.name} ilike ${pattern}
			)
		)`);
	}
	if (opts.status) conditions.push(eq(purchaseOrders.status, opts.status));
	if (opts.readyForReview !== undefined) {
		conditions.push(eq(purchaseOrders.isReadyForReview, opts.readyForReview));
	}
	if (opts.supplierId) conditions.push(eq(purchaseOrders.supplierId, opts.supplierId));
	if (opts.hasPendingBalance !== undefined) {
		const pendingCondition = buildPendingBalanceCondition();
		conditions.push(opts.hasPendingBalance ? pendingCondition : sql`NOT (${pendingCondition})`);
	}
	if (opts.hasOverdueBalance !== undefined) {
		const overdueCondition = buildOverdueBalanceCondition();
		conditions.push(opts.hasOverdueBalance ? overdueCondition : sql`NOT (${overdueCondition})`);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

async function addFinancialMetadata(
	rows: PurchaseOrderWithRelations[]
): Promise<PurchaseOrderWithRelations[]> {
	if (rows.length === 0) return rows;

	const purchaseOrderIds = rows.map((row) => row.id);
	const [items, payments, creditSchedule] = await Promise.all([
		db
			.select()
			.from(purchaseOrderItems)
			.where(inArray(purchaseOrderItems.purchaseOrderId, purchaseOrderIds)),
		db
			.select()
			.from(purchaseOrderPayments)
			.where(inArray(purchaseOrderPayments.purchaseOrderId, purchaseOrderIds)),
		db
			.select()
			.from(purchaseOrderCreditSchedule)
			.where(inArray(purchaseOrderCreditSchedule.purchaseOrderId, purchaseOrderIds))
	]);

	const itemsByOrderId = new Map<string, typeof items>();
	for (const item of items) {
		itemsByOrderId.set(item.purchaseOrderId, [
			...(itemsByOrderId.get(item.purchaseOrderId) ?? []),
			item
		]);
	}

	const paymentsByOrderId = new Map<string, typeof payments>();
	for (const payment of payments) {
		paymentsByOrderId.set(payment.purchaseOrderId, [
			...(paymentsByOrderId.get(payment.purchaseOrderId) ?? []),
			payment
		]);
	}

	const scheduleByOrderId = new Map<string, typeof creditSchedule>();
	for (const installment of creditSchedule) {
		scheduleByOrderId.set(installment.purchaseOrderId, [
			...(scheduleByOrderId.get(installment.purchaseOrderId) ?? []),
			installment
		]);
	}

	return rows.map((row) => {
		const orderItems = itemsByOrderId.get(row.id) ?? [];
		const orderPayments = paymentsByOrderId.get(row.id) ?? [];
		const orderSchedule = scheduleByOrderId.get(row.id) ?? [];
		const balance = computePurchaseOrderBalance(row, orderItems, orderPayments, orderSchedule);
		const dueStatus = getPurchaseOrderDueStatus({
			paymentTerms: row.paymentTerms,
			installments: orderSchedule,
			balance: balance.balance
		});

		return { ...row, balance, dueStatus };
	});
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
// CRUD - Purchase Orders
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
	const confirmedByUser = alias(users, 'confirmed_by_user');
	const [result] = await db
		.select({
			po: purchaseOrders,
			supplier: { id: suppliers.id, name: suppliers.name },
			createdBy: {
				id: users.id,
				fullName: users.fullName
			},
			confirmedBy: {
				id: confirmedByUser.id,
				fullName: confirmedByUser.fullName
			}
		})
		.from(purchaseOrders)
		.leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
		.leftJoin(users, eq(purchaseOrders.createdById, users.id))
		.leftJoin(confirmedByUser, eq(purchaseOrders.confirmedById, confirmedByUser.id))
		.where(eq(purchaseOrders.id, id));

	if (!result) return null;

	return {
		...result.po,
		supplier: result.supplier?.id ? result.supplier : null,
		createdBy: result.createdBy?.id ? result.createdBy : null,
		confirmedBy: result.confirmedBy?.id ? result.confirmedBy : null
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

	const orderSort = opts.orderSort ?? 'desc';
	const orderFn = orderSort === 'desc' ? desc : asc;
	const orderClause = opts.orderBy
		? orderFn(ORDER_COLUMNS[opts.orderBy])
		: desc(purchaseOrders.orderNumber);

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

	const rows = results.map((r) => ({
		...r.po,
		supplier: r.supplier?.id ? r.supplier : null,
		createdBy: r.createdBy?.id ? r.createdBy : null,
		confirmedBy: null
	}));

	return addFinancialMetadata(rows);
}

export async function countPurchaseOrders(options?: PurchaseOrderFilterOptions): Promise<number> {
	const where = buildPOConditions(options ?? {});
	const base = db.select({ value: count() }).from(purchaseOrders).$dynamic();
	if (where) base.where(where);
	const [result] = await base;
	return result.value;
}

export async function getPurchaseOrderListStats(): Promise<PurchaseOrderListStats> {
	const now = new Date();
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
	const nextMonthStart = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
	).toISOString();

	const [total, confirmed, draft, draftInProgress, draftReady, spendResult] = await Promise.all([
		countPurchaseOrders(),
		countPurchaseOrders({ status: PurchaseOrderStatus.CONFIRMED }),
		countPurchaseOrders({ status: PurchaseOrderStatus.DRAFT }),
		countPurchaseOrders({ status: PurchaseOrderStatus.DRAFT, readyForReview: false }),
		countPurchaseOrders({ status: PurchaseOrderStatus.DRAFT, readyForReview: true }),
		db
			.select({
				value: sql<number>`coalesce(sum(${purchaseOrderItems.quantity} * ${purchaseOrderItems.unitPurchasePrice}), 0)`
			})
			.from(purchaseOrderItems)
			.innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
			.where(
				and(
					isNull(purchaseOrders.deletedAt),
					eq(purchaseOrders.status, PurchaseOrderStatus.CONFIRMED),
					gte(purchaseOrders.orderDate, monthStart),
					lt(purchaseOrders.orderDate, nextMonthStart)
				)
			)
	]);

	return {
		total,
		confirmed,
		draft,
		draftInProgress,
		draftReady,
		monthlySpend: Number(spendResult[0]?.value ?? 0)
	};
}

// ---------------------------------------------------------------------------
// CRUD - Purchase Order Items
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
			product: {
				id: products.id,
				name: products.name,
				sku: products.sku,
				personalCode: products.personalCode
			},
			lensCatalogItem: {
				id: lensCatalogItems.id,
				name: lensCatalogItems.name,
				type: lensCatalogItems.type
			}
		})
		.from(purchaseOrderItems)
		.leftJoin(products, eq(purchaseOrderItems.productId, products.id))
		.leftJoin(lensCatalogItems, eq(purchaseOrderItems.lensCatalogItemId, lensCatalogItems.id))
		.where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))
		.orderBy(asc(purchaseOrderItems.createdAt), asc(purchaseOrderItems.id));

	return results.map((r) => ({
		...r.item,
		product: r.product?.id ? r.product : null,
		lensCatalogItem: r.lensCatalogItem?.id ? r.lensCatalogItem : null
	}));
}

export async function findPurchaseOrderIdByLotId(
	lotId: string,
	executor: DbOrTx = db
): Promise<string | null> {
	const [result] = await executor
		.select({ purchaseOrderId: purchaseOrderItems.purchaseOrderId })
		.from(inventoryLots)
		.innerJoin(purchaseOrderItems, eq(inventoryLots.purchaseOrderItemId, purchaseOrderItems.id))
		.where(eq(inventoryLots.id, lotId));

	return result?.purchaseOrderId ?? null;
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

export async function findPurchaseOrderItemById(
	id: string,
	executor: DbOrTx = db
): Promise<PurchaseOrderItem | null> {
	const [row] = await executor
		.select()
		.from(purchaseOrderItems)
		.where(eq(purchaseOrderItems.id, id))
		.limit(1);
	return row ?? null;
}

export async function replacePurchaseOrderItems(
	purchaseOrderId: string,
	items: PurchaseOrderItemDraftInput[],
	executor: DbOrTx = db
): Promise<PurchaseOrderItemWithProduct[]> {
	const existingItems = await executor
		.select()
		.from(purchaseOrderItems)
		.where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

	const existingIds = new Set(existingItems.map((item) => item.id));
	const incomingIds = new Set(
		items.map((item) => item.id).filter((id): id is string => Boolean(id))
	);

	for (const id of incomingIds) {
		if (!existingIds.has(id)) {
			throw new Error(`El ítem ${id} no pertenece a esta orden de compra`);
		}
	}

	for (const existing of existingItems) {
		if (!incomingIds.has(existing.id)) {
			await deletePurchaseOrderItem(existing.id, executor);
		}
	}

	const existingById = new Map(existingItems.map((existing) => [existing.id, existing]));

	for (const item of items) {
		const itemData = {
			itemType: item.itemType,
			productId: item.productId,
			lensCatalogItemId: item.lensCatalogItemId,
			quantity: item.quantity,
			unitPurchasePrice: item.unitPurchasePrice,
			unitSalePrice: item.unitSalePrice,
			appliesIva: item.appliesIva,
			ivaRate: item.ivaRate
		};

		if (item.id) {
			const previous = existingById.get(item.id);
			const materialChanged =
				!previous ||
				previous.itemType !== itemData.itemType ||
				previous.productId !== itemData.productId ||
				previous.lensCatalogItemId !== itemData.lensCatalogItemId ||
				previous.quantity !== itemData.quantity ||
				previous.unitPurchasePrice !== itemData.unitPurchasePrice ||
				previous.unitSalePrice !== itemData.unitSalePrice ||
				previous.appliesIva !== itemData.appliesIva ||
				previous.ivaRate !== itemData.ivaRate;
			// If material fields changed, force isReviewed=false (defense-in-depth).
			// Otherwise honor the client-provided value (if any) so reviewed lines
			// stay reviewed across save cycles.
			const nextReviewed = materialChanged
				? false
				: (item.isReviewed ?? previous?.isReviewed ?? false);
			await updatePurchaseOrderItem(item.id, { ...itemData, isReviewed: nextReviewed }, executor);
		} else {
			// New rows always start unreviewed (default column value).
			await createPurchaseOrderItem({ purchaseOrderId, ...itemData }, executor);
		}
	}

	return getPurchaseOrderItems(purchaseOrderId, executor);
}

export async function setPurchaseOrderItemReviewed(
	itemId: string,
	isReviewed: boolean,
	executor: DbOrTx = db
): Promise<PurchaseOrderItem> {
	const [updated] = await executor
		.update(purchaseOrderItems)
		.set({ isReviewed, updatedAt: nowISO() })
		.where(eq(purchaseOrderItems.id, itemId))
		.returning();
	return updated;
}

export async function clearPurchaseOrderItemsReviewed(
	purchaseOrderId: string,
	executor: DbOrTx = db
): Promise<void> {
	await executor
		.update(purchaseOrderItems)
		.set({ isReviewed: false, updatedAt: nowISO() })
		.where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
}

export async function setPurchaseOrderReadyForReview(
	id: string,
	isReadyForReview: boolean,
	executor: DbOrTx = db,
	clearReviewed: boolean = false
): Promise<PurchaseOrder> {
	if (clearReviewed) {
		await clearPurchaseOrderItemsReviewed(id, executor);
	}
	const [po] = await executor
		.update(purchaseOrders)
		.set({ isReadyForReview, updatedAt: nowISO() })
		.where(eq(purchaseOrders.id, id))
		.returning();
	return po;
}

// ---------------------------------------------------------------------------
// PO Confirmation - The core transaction
// ---------------------------------------------------------------------------

function roundCurrency(value: number): number {
	return Math.round(value * 100) / 100;
}

/**
 * Computes the multiplicative factor that converts each item's gross
 * `unitPurchasePrice` into the net price actually paid (after the header's
 * settlement discount). Returns 1 when there is no discount or the subtotal
 * is zero. The factor is computed against the gross pre-tax subtotal so it
 * applies linearly to both pre-tax and tax-included unit prices.
 */
function computeSettlementDiscountFactor(
	items: { unitPurchasePrice: number; quantity: number; appliesIva: boolean; ivaRate: number }[],
	po: { settlementDiscountType: string; settlementDiscountValue: number }
): number {
	const type = po.settlementDiscountType as PurchaseDiscountType;
	const value = Number(po.settlementDiscountValue || 0);
	if (type === PurchaseDiscountType.NONE || value <= 0) return 1;

	const subtotalPreTax = items.reduce((sum, item) => {
		const unit = Number(item.unitPurchasePrice || 0);
		const preTax = item.appliesIva && item.ivaRate ? unit / (1 + item.ivaRate / 100) : unit;
		return sum + preTax * Number(item.quantity || 0);
	}, 0);
	if (subtotalPreTax <= 0) return 1;

	const discountAmount =
		type === PurchaseDiscountType.PERCENT
			? (subtotalPreTax * Math.min(value, 100)) / 100
			: Math.min(value, subtotalPreTax);
	const factor = (subtotalPreTax - discountAmount) / subtotalPreTax;
	if (!Number.isFinite(factor)) return 1;
	return Math.max(0, Math.min(1, factor));
}

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
	if (!po.isReadyForReview) {
		throw new Error('El borrador debe marcarse como listo para revisar antes de confirmarlo');
	}

	// 2. Get all items for this PO
	const items = await tx
		.select()
		.from(purchaseOrderItems)
		.where(eq(purchaseOrderItems.purchaseOrderId, poId));

	if (items.length === 0) {
		throw new Error('No se puede confirmar una orden sin ítems');
	}

	const pendingReview = items.filter((item) => !item.isReviewed).length;
	if (pendingReview > 0) {
		throw new Error(
			`Faltan ${pendingReview} línea(s) por marcar como revisadas antes de confirmar`
		);
	}

	// 3a. Compute settlement-discount factor (applied to each lot's cost on
	//     confirmation so COGS, FIFO, and inventory valuation reflect what we
	//     actually paid). Lines themselves stay at gross prices for traceability
	//     with the supplier's delivery note.
	const discountFactor = computeSettlementDiscountFactor(items, po);

	// 3. Process each item
	for (const item of items) {
		const netUnitPurchasePrice = roundCurrency(item.unitPurchasePrice * discountFactor);

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
				unitPurchasePrice: netUnitPurchasePrice,
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
		// NOTE: currentSalePrice is NOT updated here - it requires explicit user approval
		if (item.itemType === PurchaseOrderItemType.PRODUCT && item.productId) {
			const fifoCost = await getNextFifoCost(item.productId, tx);
			await tx
				.update(products)
				.set({
					stock: sql`${products.stock} + ${item.quantity}`,
					currentPurchasePrice: fifoCost ?? netUnitPurchasePrice,
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
			isReadyForReview: false,
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
			isReadyForReview: false,
			updatedAt: nowISO()
		})
		.where(eq(purchaseOrders.id, poId))
		.returning();

	return cancelled;
}
