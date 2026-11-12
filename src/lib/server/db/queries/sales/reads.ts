/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: sale reads.
 */
import type {
	GetSalesOptions,
	SaleFilterOptions,
	SaleListItem,
	SaleOrderBy,
	SaleStatusCounts,
	SaleWithRelations,
	SalesSelectionSummary,
	SalesStats
} from './types';
import { buildSaleConditions, saleSearchFields } from './shared';
import { eq, isNull, and, desc, asc, max, count, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import { relevanceScoreOrderSql } from '$lib/server/db/search';
import { SALE_PAID_EPSILON } from '$lib/shared/saleBalance';
import { SaleStatus } from '$lib/shared/enums';
import type { DbOrTx } from '$lib/server/db/types';

import {
	sales,
	customers,
	users,
	prescriptions,
	saleItems,
	type Sale,
	type Prescription
} from '$lib/server/db/schema';
import type { AnyColumn } from 'drizzle-orm';

/** Column map for orderBy (saleDate is an alias of createdAt — single date truth) */
const ORDER_COLUMNS: Partial<Record<SaleOrderBy, AnyColumn>> = {
	saleDate: sales.createdAt,
	orderNumber: sales.orderNumber,
	total: sales.total,
	createdAt: sales.createdAt
};

/**
 * Expresión de orden. `balance` no es columna: ordena por (total − paid) con las
 * canceladas al final (no tienen saldo) y sin saldos negativos.
 */
function saleOrderExpression(orderBy: SaleOrderBy): SQL | AnyColumn {
	if (orderBy === 'balance') {
		return sql<number>`(CASE WHEN ${sales.status} = 'CANCELLED' THEN -1 ELSE GREATEST(${sales.total} - ${sales.paidAmountBcvUsd}, 0) END)`;
	}
	return ORDER_COLUMNS[orderBy] ?? sales.orderNumber;
}

// ============================================================================
// SALES
// ============================================================================

/**
 * Get the next order number (MAX + 1).
 * When called inside a transaction, ensures sequential numbering without gaps.
 */
/**
 * Linked prescription of a sale's lens items (DP / nasal measures source).
 * Null when the sale has no lens pairs or they were created without one.
 */
export async function getSalePrescription(
	saleId: string,
	executor: DbOrTx = db
): Promise<Prescription | null> {
	const [row] = await executor
		.select({ prescription: prescriptions })
		.from(saleItems)
		.innerJoin(prescriptions, eq(saleItems.prescriptionId, prescriptions.id))
		.where(and(eq(saleItems.saleId, saleId), isNull(saleItems.deletedAt)))
		.orderBy(saleItems.createdAt)
		.limit(1);
	return row?.prescription ?? null;
}

export async function getNextOrderNumber(executor: DbOrTx = db): Promise<number> {
	const [row] = await executor.select({ maxNum: max(sales.orderNumber) }).from(sales);
	return (row?.maxNum ?? 0) + 1;
}

/**
 * Get all sales with customer and seller info + flags de ítem por fila
 * (envío pendiente / ítem libre, baratos: dos EXISTS correlacionados).
 *
 * @example
 * getAllSales()                                                 // non-deleted, newest first
 * getAllSales({ status: 'COMPLETED', limit: 10 })               // filtered + paginated
 * getAllSales({ customerId: '...', dateFrom: new Date() })      // by customer + date
 * getAllSales({ search: 'john', orderBy: 'balance' })           // mayor saldo primero
 */
export async function getAllSales(options?: GetSalesOptions): Promise<SaleListItem[]> {
	const opts = options ?? {};
	const where = buildSaleConditions(opts);

	// Default: newest first (by order number)
	const orderFn = opts.orderSort === 'asc' ? asc : desc;
	const orderCol = opts.orderBy ? saleOrderExpression(opts.orderBy) : sales.orderNumber;

	const base = db
		.select({
			sale: sales,
			customer: {
				id: customers.id,
				firstName: customers.firstName,
				lastName: customers.lastName,
				idNumber: customers.idNumber,
				birthDate: customers.birthDate,
				primaryPhone: customers.primaryPhone,
				gender: customers.gender,
				address: customers.address
			},
			seller: { id: users.id, fullName: users.fullName },
			hasShippingPending: sql<boolean>`exists (select 1 from ${saleItems} where ${saleItems.saleId} = ${sales.id} and ${saleItems.shippingCostPending} = true and ${saleItems.deletedAt} is null)`,
			hasFreeItem: sql<boolean>`exists (select 1 from ${saleItems} where ${saleItems.saleId} = ${sales.id} and ${saleItems.itemType} = 'FREE_ITEM' and ${saleItems.deletedAt} is null)`
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.$dynamic();

	if (where) base.where(where);
	const orderByColumns: SQL[] = [];
	if (opts.search) {
		orderByColumns.push(relevanceScoreOrderSql(opts.search.trim(), saleSearchFields()));
	}
	orderByColumns.push(orderFn(orderCol));
	if (opts.orderBy === 'balance') {
		// Desempate estable: saldo → número de orden (más reciente arriba).
		orderByColumns.push(desc(sales.orderNumber));
	}
	if (orderByColumns.length > 0) base.orderBy(...orderByColumns);
	if (opts.limit) base.limit(opts.limit);
	if (opts.offset) base.offset(opts.offset);

	const results = await base;

	return results.map((r) => ({
		...r.sale,
		/** Alias sourced from createdAt (single date truth) */
		saleDate: r.sale.createdAt,
		customer: r.customer?.id ? r.customer : null,
		seller: r.seller?.id ? r.seller : null,
		cancelledBy: null,
		refundedBy: null,
		hasShippingPending: r.hasShippingPending === true,
		hasFreeItem: r.hasFreeItem === true
	}));
}

/**
 * Count sales matching the given filters.
 * Uses the same conditions as getAllSales.
 */
export async function countSales(options?: SaleFilterOptions): Promise<number> {
	const where = buildSaleConditions(options ?? {});

	// JOINs needed because search references customer/seller columns
	const base = db
		.select({ value: count() })
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.$dynamic();

	if (where) base.where(where);
	const [result] = await base;
	return result.value;
}

/**
 * Get aggregated sales stats in a single query using conditional counts/sums
 * (una sola consulta: KPIs del listado + conteos por estado).
 *
 * Alcance: GLOBAL (no reacciona a los filtros del listado) — decisión del rediseño.
 *
 * @param monthStartIso - ISO date string for the start of the current month
 */
export async function getSalesStats(monthStartIso: string): Promise<SalesStats> {
	const [row] = await db
		.select({
			total: count(),
			monthly: sql<number>`count(*) filter (where ${sales.createdAt} >= ${monthStartIso})`.mapWith(
				Number
			),
			monthlyTotalUsd:
				sql<number>`coalesce(sum(${sales.total}) filter (where ${sales.createdAt} >= ${monthStartIso} and ${sales.status} != 'CANCELLED'), 0)`.mapWith(
					Number
				),
			pending: sql<number>`count(*) filter (where ${sales.status} = 'PENDING')`.mapWith(Number),
			completed: sql<number>`count(*) filter (where ${sales.status} = 'COMPLETED')`.mapWith(Number),
			cancelled: sql<number>`count(*) filter (where ${sales.status} = 'CANCELLED')`.mapWith(Number),
			ready: sql<number>`count(*) filter (where ${sales.status} = 'READY')`.mapWith(Number),
			receivableCount:
				sql<number>`count(*) filter (where ${sales.status} != 'CANCELLED' and (${sales.total} - ${sales.paidAmountBcvUsd}) > ${SALE_PAID_EPSILON})`.mapWith(
					Number
				),
			receivableAmount:
				sql<number>`coalesce(sum(${sales.total} - ${sales.paidAmountBcvUsd}) filter (where ${sales.status} != 'CANCELLED' and (${sales.total} - ${sales.paidAmountBcvUsd}) > ${SALE_PAID_EPSILON}), 0)`.mapWith(
					Number
				)
		})
		.from(sales)
		.where(isNull(sales.deletedAt));

	return row;
}

/**
 * Conteo de ventas por estado respetando TODOS los filtros excepto el de estados
 * (pestañas facetadas del listado: el conteo de cada pestaña ignora la propia pestaña).
 * Una sola query con GROUP BY.
 */
export async function countSalesByStatus(options?: SaleFilterOptions): Promise<SaleStatusCounts> {
	const where = buildSaleConditions({ ...options, statuses: undefined });

	const base = db
		.select({ status: sales.status, value: count() })
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.$dynamic();

	if (where) base.where(where);
	const rows = await base.groupBy(sales.status);

	const counts: SaleStatusCounts = {
		[SaleStatus.PENDING]: 0,
		[SaleStatus.IN_PROGRESS]: 0,
		[SaleStatus.READY]: 0,
		[SaleStatus.COMPLETED]: 0,
		[SaleStatus.CANCELLED]: 0
	};
	for (const row of rows) {
		counts[row.status as SaleStatus] = row.value;
	}
	return counts;
}

/**
 * Resumen de la SELECCIÓN: suma de todas las ventas que cumplen los filtros
 * (no solo la página), sin canceladas. Una sola query.
 */
export async function sumSalesForSelection(
	options?: SaleFilterOptions
): Promise<SalesSelectionSummary> {
	const where = and(buildSaleConditions(options ?? {}), sql`${sales.status} != 'CANCELLED'`);

	const base = db
		.select({
			count: count(),
			totalUsd: sql<number>`coalesce(sum(${sales.total}), 0)`.mapWith(Number),
			balanceUsd:
				sql<number>`coalesce(sum(greatest(${sales.total} - ${sales.paidAmountBcvUsd}, 0)), 0)`.mapWith(
					Number
				)
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.$dynamic();

	if (where) base.where(where);
	const [row] = await base;

	return {
		count: row?.count ?? 0,
		totalUsd: row?.totalUsd ?? 0,
		balanceUsd: row?.balanceUsd ?? 0
	};
}

/**
 * Vendedores distintos que aparecen en ventas no borradas (select de filtros).
 * Incluye usuarios hoy desactivados si tienen ventas históricas.
 */
export async function listSaleSellers(): Promise<{ id: string; fullName: string }[]> {
	return db
		.selectDistinct({ id: users.id, fullName: users.fullName })
		.from(users)
		.innerJoin(sales, eq(sales.sellerId, users.id))
		.where(isNull(sales.deletedAt))
		.orderBy(users.fullName);
}

/** Página de listado + totales que necesita la UI (todo en paralelo, 4 queries). */
export interface SalesListPage {
	sales: SaleListItem[];
	total: number;
	/** Conteos por estado respetando los demás filtros (pestañas). */
	facets: SaleStatusCounts;
	/** Suma de la selección completa (no solo la página), sin canceladas. */
	selection: SalesSelectionSummary;
}

/**
 * Todo lo que el listado necesita por cada cambio de filtro, en un solo lugar
 * (lo usan el `+page.server.ts` y el remote `listSales`: sin lógica duplicada).
 */
export async function getSalesListPage(options?: GetSalesOptions): Promise<SalesListPage> {
	const [sales, total, facets, selection] = await Promise.all([
		getAllSales(options),
		countSales(options),
		countSalesByStatus(options),
		sumSalesForSelection(options)
	]);

	return { sales, total, facets, selection };
}

/**
 * Find a sale by ID
 * @param deleted - If true, also matches soft-deleted sales (default: false)
 */
export async function findSaleById(
	id: string,
	{ deleted }: { deleted?: boolean } = {},
	executor: DbOrTx = db
): Promise<Sale | null> {
	const filter = deleted ? eq(sales.id, id) : and(eq(sales.id, id), isNull(sales.deletedAt));
	const [sale] = await executor.select().from(sales).where(filter!);
	return sale ?? null;
}

/**
 * Find a single sale by ID with customer/seller relations
 * @param deleted - If true, also matches soft-deleted sales (default: false)
 */
export async function findSaleByIdWithRelations(
	id: string,
	{ deleted }: { deleted?: boolean } = {}
): Promise<SaleWithRelations | null> {
	const filter = deleted ? eq(sales.id, id) : and(eq(sales.id, id), isNull(sales.deletedAt));
	const cancelledByUser = alias(users, 'cancelled_by_user');
	const refundedByUser = alias(users, 'refunded_by_user');

	const [result] = await db
		.select({
			sale: sales,
			customer: {
				id: customers.id,
				firstName: customers.firstName,
				lastName: customers.lastName,
				idNumber: customers.idNumber,
				birthDate: customers.birthDate,
				primaryPhone: customers.primaryPhone,
				gender: customers.gender,
				address: customers.address
			},
			seller: { id: users.id, fullName: users.fullName },
			cancelledBy: { id: cancelledByUser.id, fullName: cancelledByUser.fullName },
			refundedBy: { id: refundedByUser.id, fullName: refundedByUser.fullName }
		})
		.from(sales)
		.leftJoin(customers, eq(sales.customerId, customers.id))
		.leftJoin(users, eq(sales.sellerId, users.id))
		.leftJoin(cancelledByUser, eq(sales.cancelledById, cancelledByUser.id))
		.leftJoin(refundedByUser, eq(sales.refundedById, refundedByUser.id))
		.where(filter!);

	if (!result) return null;

	return {
		...result.sale,
		/** Alias sourced from createdAt (single date truth) */
		saleDate: result.sale.createdAt,
		customer: result.customer?.id ? result.customer : null,
		seller: result.seller?.id ? result.seller : null,
		cancelledBy: result.cancelledBy?.id ? result.cancelledBy : null,
		refundedBy: result.refundedBy?.id ? result.refundedBy : null
	};
}
