/**
 * Inventory count query internals (private helpers + row types).
 * Split from queries/inventoryCount.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type {
	InventoryCountLineFilter,
	InventoryCountSessionSummary,
	InventoryCountSnapshotInput
} from './types';
import { and, asc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';

import type { DbOrTx } from '$lib/server/db/types';

import {
	inventoryCountLines,
	inventoryMovements,
	lensCatalogItems,
	products,
	users,
	type InventoryCountSession
} from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';
import { UserRole } from '$lib/shared/enums';

export type InventoryCountUserRow = {
	id: string;
	fullName: string;
	role: UserRole;
};

export type SessionLineSummaryRow = {
	sessionId: number;
	totalLines: number;
	countedLines: number;
	positiveDifferences: number;
	negativeDifferences: number;
	matchedLines: number;
};

export type SnapshotRow = {
	itemType: 'PRODUCT' | 'LENS';
	productId: string | null;
	lensCatalogItemId: string | null;
	systemStock: number;
};

export function requireOpenSession(
	session: InventoryCountSession | null
): asserts session is InventoryCountSession {
	if (!session) {
		throw new Error('Sesión de conteo no encontrada');
	}

	if (session.status !== 'OPEN') {
		throw new Error('La sesión ya no está abierta');
	}
}

export function normalizeSessionNotes(notes?: string | null): string | null {
	const value = notes?.trim();
	return value ? value : null;
}

export function buildSessionLineFilter(filter: InventoryCountLineFilter): SQL | undefined {
	if (filter === 'COUNTED') {
		return isNotNull(inventoryCountLines.countedStock);
	}

	if (filter === 'PENDING') {
		return isNull(inventoryCountLines.countedStock);
	}

	if (filter === 'WITH_DIFF') {
		return sql`${inventoryCountLines.countedStock} is not null and ${inventoryCountLines.difference} != 0`;
	}

	return undefined;
}

export async function getUserMap(userIds: Array<string | null | undefined>, executor: DbOrTx) {
	const uniqueUserIds = [...new Set(userIds.filter((userId): userId is string => Boolean(userId)))];

	if (uniqueUserIds.length === 0) {
		return new Map<string, InventoryCountUserRow>();
	}

	const rows = await executor
		.select({ id: users.id, fullName: users.fullName, role: users.role })
		.from(users)
		.where(inArray(users.id, uniqueUserIds));

	return new Map(rows.map((row) => [row.id, row]));
}

export async function getSessionLineSummaryMap(sessionIds: number[], executor: DbOrTx) {
	if (sessionIds.length === 0) {
		return new Map<number, SessionLineSummaryRow>();
	}

	const rows = await executor
		.select({
			sessionId: inventoryCountLines.sessionId,
			totalLines: sql<number>`count(*)`.mapWith(Number),
			countedLines:
				sql<number>`count(*) filter (where ${inventoryCountLines.countedStock} is not null)`.mapWith(
					Number
				),
			positiveDifferences:
				sql<number>`count(*) filter (where ${inventoryCountLines.countedStock} is not null and ${inventoryCountLines.difference} > 0)`.mapWith(
					Number
				),
			negativeDifferences:
				sql<number>`count(*) filter (where ${inventoryCountLines.countedStock} is not null and ${inventoryCountLines.difference} < 0)`.mapWith(
					Number
				),
			matchedLines:
				sql<number>`count(*) filter (where ${inventoryCountLines.countedStock} is not null and ${inventoryCountLines.difference} = 0)`.mapWith(
					Number
				)
		})
		.from(inventoryCountLines)
		.where(inArray(inventoryCountLines.sessionId, sessionIds))
		.groupBy(inventoryCountLines.sessionId);

	return new Map(rows.map((row) => [row.sessionId, row]));
}

export async function enrichSessions(
	sessions: InventoryCountSession[],
	executor: DbOrTx
): Promise<InventoryCountSessionSummary[]> {
	if (sessions.length === 0) {
		return [];
	}

	const [userMap, summaryMap] = await Promise.all([
		getUserMap(
			sessions.flatMap((session) => [
				session.openedById,
				session.appliedById,
				session.cancelledById
			]),
			executor
		),
		getSessionLineSummaryMap(
			sessions.map((session) => session.id),
			executor
		)
	]);

	return sessions.map((session) => {
		const summary = summaryMap.get(session.id);
		const totalLines = summary?.totalLines ?? 0;
		const countedLines = summary?.countedLines ?? 0;

		return {
			...session,
			openedByName: userMap.get(session.openedById)?.fullName ?? null,
			appliedByName: session.appliedById
				? (userMap.get(session.appliedById)?.fullName ?? null)
				: null,
			cancelledByName: session.cancelledById
				? (userMap.get(session.cancelledById)?.fullName ?? null)
				: null,
			totalLines,
			countedLines,
			pendingLines: Math.max(totalLines - countedLines, 0),
			positiveDifferences: summary?.positiveDifferences ?? 0,
			negativeDifferences: summary?.negativeDifferences ?? 0,
			matchedLines: summary?.matchedLines ?? 0
		};
	});
}

export async function selectProductSnapshotRows(
	scopeValue: string | null | undefined,
	executor: DbOrTx
): Promise<SnapshotRow[]> {
	const conditions: SQL[] = [
		isNull(products.deletedAt),
		sql`(
			coalesce(${products.stock}, 0) > 0
			or exists (
				select 1
				from ${inventoryMovements}
				where ${inventoryMovements.productId} = ${products.id}
			)
		)`
	];

	if (scopeValue) {
		conditions.push(eq(products.type, scopeValue));
	}

	const rows = await executor
		.select({
			productId: products.id,
			systemStock: sql<number>`coalesce(${products.stock}, 0)`.mapWith(Number)
		})
		.from(products)
		.where(and(...conditions))
		.orderBy(asc(products.name));

	return rows.map((row) => ({
		itemType: 'PRODUCT',
		productId: row.productId,
		lensCatalogItemId: null,
		systemStock: row.systemStock
	}));
}

export async function selectLensSnapshotRows(executor: DbOrTx): Promise<SnapshotRow[]> {
	const rows = await executor
		.select({
			lensCatalogItemId: lensCatalogItems.id,
			systemStock: sql<number>`coalesce(${lensCatalogItems.stock}, 0)`.mapWith(Number)
		})
		.from(lensCatalogItems)
		.where(
			and(
				isNull(lensCatalogItems.deletedAt),
				eq(lensCatalogItems.inventoryMode, 'STOCK'),
				sql`(
					coalesce(${lensCatalogItems.stock}, 0) > 0
					or exists (
						select 1
						from ${inventoryMovements}
						where ${inventoryMovements.lensCatalogItemId} = ${lensCatalogItems.id}
					)
				)`
			)
		)
		.orderBy(asc(lensCatalogItems.name));

	return rows.map((row) => ({
		itemType: 'LENS',
		productId: null,
		lensCatalogItemId: row.lensCatalogItemId,
		systemStock: row.systemStock
	}));
}

export async function createSnapshotLines(
	sessionId: number,
	data: InventoryCountSnapshotInput,
	executor: DbOrTx
) {
	let rows: SnapshotRow[];

	if (data.scopeType === 'ALL') {
		const [productsRows, lensRows] = await Promise.all([
			selectProductSnapshotRows(null, executor),
			selectLensSnapshotRows(executor)
		]);
		rows = [...productsRows, ...lensRows];
	} else if (data.scopeType === 'PRODUCT_CATEGORY') {
		rows = await selectProductSnapshotRows(data.scopeValue ?? null, executor);
	} else {
		rows = await selectLensSnapshotRows(executor);
	}

	if (rows.length === 0) {
		throw new Error('No hay ítems elegibles para este conteo');
	}

	await executor.insert(inventoryCountLines).values(
		rows.map((row) => ({
			sessionId,
			itemType: row.itemType,
			productId: row.productId,
			lensCatalogItemId: row.lensCatalogItemId,
			systemStock: row.systemStock,
			createdAt: nowISO(),
			updatedAt: nowISO()
		}))
	);
}
