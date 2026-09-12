/**
 * Purchase order queries — order CRUD + reads.
 * Split from queries/purchaseOrders.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type {
	GetPurchaseOrdersOptions,
	PurchaseOrderFilterOptions,
	PurchaseOrderListStats,
	PurchaseOrderOrderBy,
	PurchaseOrderWithRelations
} from './types';
import { addFinancialMetadata, buildPOConditions, poSearchFields } from './shared';

const ORDER_COLUMNS: Record<PurchaseOrderOrderBy, AnyColumn> = {
	orderNumber: purchaseOrders.orderNumber,
	orderDate: purchaseOrders.orderDate,
	createdAt: purchaseOrders.createdAt,
	status: purchaseOrders.status
};
import {
	eq,
	and,
	isNull,
	asc,
	desc,
	count,
	gte,
	lt,
	sql,
	type AnyColumn,
	type SQL
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { relevanceScoreOrderSql } from '$lib/server/db/search';
import {
	purchaseOrders,
	purchaseOrderItems,
	suppliers,
	users,
	type PurchaseOrder,
	type NewPurchaseOrder
} from '$lib/server/db/schema';
import type { DbOrTx } from '$lib/server/db/types';
import { PurchaseOrderStatus } from '$lib/shared/enums';

import { nowISO } from '$lib/dates';

// ---------------------------------------------------------------------------
// Types
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
	const orderByColumns: SQL[] = [];
	if (opts.search?.trim()) {
		orderByColumns.push(relevanceScoreOrderSql(opts.search.trim(), poSearchFields()));
	}
	orderByColumns.push(orderClause);
	if (orderByColumns.length > 0) base.orderBy(...orderByColumns);
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
	const base = db
		.select({ value: count() })
		.from(purchaseOrders)
		.leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
		.$dynamic();
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
