import { and, asc, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import {
	inventoryCountLines,
	inventoryCountSessions,
	inventoryMovements,
	lensCatalogItems,
	products,
	users,
	type InventoryCountLine,
	type InventoryCountSession
} from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';
import { UserRole } from '$lib/shared/enums';

export const INVENTORY_COUNT_SESSION_STATUSES = ['OPEN', 'APPLIED', 'CANCELLED'] as const;
export type InventoryCountSessionStatus = (typeof INVENTORY_COUNT_SESSION_STATUSES)[number];

export const INVENTORY_COUNT_SCOPE_TYPES = ['ALL', 'PRODUCT_CATEGORY', 'LENS'] as const;
export type InventoryCountScopeType = (typeof INVENTORY_COUNT_SCOPE_TYPES)[number];

export const INVENTORY_COUNT_LINE_FILTERS = ['ALL', 'COUNTED', 'PENDING', 'WITH_DIFF'] as const;
export type InventoryCountLineFilter = (typeof INVENTORY_COUNT_LINE_FILTERS)[number];

export interface InventoryCountSessionSummary extends InventoryCountSession {
	openedByName: string | null;
	appliedByName: string | null;
	cancelledByName: string | null;
	totalLines: number;
	countedLines: number;
	pendingLines: number;
	positiveDifferences: number;
	negativeDifferences: number;
	matchedLines: number;
}

export interface InventoryCountLineRow extends InventoryCountLine {
	itemId: string;
	itemName: string;
	itemCode: string | null;
	itemDetail: string | null;
	currentStock: number;
	countedByName: string | null;
	adjustmentCompletedByName: string | null;
}

export interface InventoryCountSessionDetail extends InventoryCountSessionSummary {
	lines: InventoryCountLineRow[];
}

export interface InventoryCountSnapshotInput {
	scopeType: InventoryCountScopeType;
	scopeValue?: string | null;
	notes?: string | null;
	openedById: string;
}

export interface UpsertCountLineInput {
	sessionId: number;
	itemId: string;
	itemType: 'PRODUCT' | 'LENS';
	countedStock: number;
	userId: string;
	notes?: string | null;
}

export interface SetCountLineAdjustmentStatusInput {
	lineId: number;
	adjustmentCompleted: boolean;
	userId: string;
}

type InventoryCountUserRow = {
	id: string;
	fullName: string;
	role: UserRole;
};

type SessionLineSummaryRow = {
	sessionId: number;
	totalLines: number;
	countedLines: number;
	positiveDifferences: number;
	negativeDifferences: number;
	matchedLines: number;
};

type SnapshotRow = {
	itemType: 'PRODUCT' | 'LENS';
	productId: string | null;
	lensCatalogItemId: string | null;
	systemStock: number;
};

function requireOpenSession(
	session: InventoryCountSession | null
): asserts session is InventoryCountSession {
	if (!session) {
		throw new Error('Sesión de conteo no encontrada');
	}

	if (session.status !== 'OPEN') {
		throw new Error('La sesión ya no está abierta');
	}
}

function normalizeSessionNotes(notes?: string | null): string | null {
	const value = notes?.trim();
	return value ? value : null;
}

function buildSessionLineFilter(filter: InventoryCountLineFilter): SQL | undefined {
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

async function getUserMap(userIds: Array<string | null | undefined>, executor: DbOrTx) {
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

async function getSessionLineSummaryMap(sessionIds: number[], executor: DbOrTx) {
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

async function enrichSessions(
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

async function selectProductSnapshotRows(
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

async function selectLensSnapshotRows(executor: DbOrTx): Promise<SnapshotRow[]> {
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

async function createSnapshotLines(
	sessionId: number,
	data: InventoryCountSnapshotInput,
	executor: DbOrTx
) {
	let rows: SnapshotRow[] = [];

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

export async function getActiveSession(
	executor: DbOrTx = db
): Promise<InventoryCountSessionSummary | null> {
	const [session] = await executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.status, 'OPEN'))
		.orderBy(desc(inventoryCountSessions.openedAt))
		.limit(1);

	if (!session) {
		return null;
	}

	const [enriched] = await enrichSessions([session], executor);
	return enriched ?? null;
}

export async function getSessions(
	limit = 20,
	executor: DbOrTx = db
): Promise<InventoryCountSessionSummary[]> {
	const sessions = await executor
		.select()
		.from(inventoryCountSessions)
		.orderBy(desc(inventoryCountSessions.openedAt))
		.limit(limit);

	return enrichSessions(sessions, executor);
}

export async function getSessionLines(
	sessionId: number,
	filter: InventoryCountLineFilter = 'ALL',
	executor: DbOrTx = db
): Promise<InventoryCountLineRow[]> {
	const adjustmentCompletedByUser = alias(users, 'inventory_count_adjustment_completed_by_user');
	const conditions: SQL[] = [eq(inventoryCountLines.sessionId, sessionId)];
	const filterCondition = buildSessionLineFilter(filter);
	if (filterCondition) {
		conditions.push(filterCondition);
	}

	const rows = await executor
		.select({
			line: inventoryCountLines,
			productName: products.name,
			productSku: products.sku,
			productType: products.type,
			productStock: products.stock,
			lensName: lensCatalogItems.name,
			lensType: lensCatalogItems.type,
			lensStock: lensCatalogItems.stock,
			countedByName: users.fullName,
			adjustmentCompletedByName: adjustmentCompletedByUser.fullName
		})
		.from(inventoryCountLines)
		.leftJoin(products, eq(inventoryCountLines.productId, products.id))
		.leftJoin(lensCatalogItems, eq(inventoryCountLines.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(users, eq(inventoryCountLines.countedById, users.id))
		.leftJoin(
			adjustmentCompletedByUser,
			eq(inventoryCountLines.adjustmentCompletedById, adjustmentCompletedByUser.id)
		)
		.where(and(...conditions))
		.orderBy(
			asc(inventoryCountLines.itemType),
			asc(products.name),
			asc(lensCatalogItems.name),
			asc(inventoryCountLines.id)
		);

	return rows.map((row) => ({
		...row.line,
		itemId: row.line.productId ?? row.line.lensCatalogItemId ?? '',
		itemName: row.productName ?? row.lensName ?? 'Ítem sin nombre',
		itemCode: row.productSku ?? row.lensType ?? null,
		itemDetail: row.productType ?? row.lensType ?? null,
		currentStock: row.line.itemType === 'PRODUCT' ? (row.productStock ?? 0) : (row.lensStock ?? 0),
		countedByName: row.countedByName ?? null,
		adjustmentCompletedByName: row.adjustmentCompletedByName ?? null
	}));
}

export async function getSessionById(
	id: number,
	executor: DbOrTx = db
): Promise<InventoryCountSessionDetail | null> {
	const [session] = await executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.id, id))
		.limit(1);

	if (!session) {
		return null;
	}

	const [[enriched], lines] = await Promise.all([
		enrichSessions([session], executor),
		getSessionLines(id, 'ALL', executor)
	]);

	if (!enriched) {
		return null;
	}

	return { ...enriched, lines };
}

export async function createSession(
	data: InventoryCountSnapshotInput,
	executor: DbOrTx = db
): Promise<InventoryCountSessionDetail> {
	if (executor === db) {
		return db.transaction(async (tx) => createSession(data, tx));
	}

	const existing = await getActiveSession(executor);
	if (existing) {
		throw new Error('Ya existe una sesión de conteo abierta');
	}

	const [session] = await executor
		.insert(inventoryCountSessions)
		.values({
			status: 'OPEN',
			scopeType: data.scopeType,
			scopeValue: data.scopeValue ?? null,
			notes: normalizeSessionNotes(data.notes),
			openedById: data.openedById,
			openedAt: nowISO(),
			createdAt: nowISO(),
			updatedAt: nowISO()
		})
		.returning();

	await createSnapshotLines(session.id, data, executor);

	const detail = await getSessionById(session.id, executor);
	if (!detail) {
		throw new Error('No se pudo cargar la sesión recién creada');
	}

	return detail;
}

export async function cancelSession(
	id: number,
	userId: string,
	reason: string,
	executor: DbOrTx = db
): Promise<InventoryCountSessionDetail> {
	const session = await getSessionById(id, executor);
	requireOpenSession(session);

	const cancelReason = reason.trim();
	if (!cancelReason) {
		throw new Error('Debes indicar el motivo de cancelación');
	}

	await executor
		.update(inventoryCountSessions)
		.set({
			status: 'CANCELLED',
			cancelledById: userId,
			cancelledAt: nowISO(),
			cancelReason,
			updatedAt: nowISO()
		})
		.where(eq(inventoryCountSessions.id, id));

	const updated = await getSessionById(id, executor);
	if (!updated) {
		throw new Error('No se pudo cargar la sesión cancelada');
	}

	return updated;
}

export async function upsertCountLine(
	data: UpsertCountLineInput,
	executor: DbOrTx = db
): Promise<InventoryCountLineRow> {
	const session = await getSessionById(data.sessionId, executor);
	requireOpenSession(session);

	const lineConditions: SQL[] = [
		eq(inventoryCountLines.sessionId, data.sessionId),
		eq(inventoryCountLines.itemType, data.itemType)
	];

	if (data.itemType === 'PRODUCT') {
		lineConditions.push(eq(inventoryCountLines.productId, data.itemId));
	} else {
		lineConditions.push(eq(inventoryCountLines.lensCatalogItemId, data.itemId));
	}

	const [line] = await executor
		.select()
		.from(inventoryCountLines)
		.where(and(...lineConditions))
		.limit(1);

	if (!line) {
		throw new Error('El ítem no pertenece a la sesión activa');
	}

	const nextNotes = data.notes === undefined ? line.notes : normalizeSessionNotes(data.notes);
	const nextDifference = data.countedStock - line.systemStock;
	const shouldResetAdjustmentTracking =
		line.adjustmentCompleted &&
		(line.countedStock !== data.countedStock || (line.difference ?? null) !== nextDifference);

	await executor
		.update(inventoryCountLines)
		.set({
			countedStock: data.countedStock,
			difference: nextDifference,
			adjustmentCompleted: shouldResetAdjustmentTracking ? false : line.adjustmentCompleted,
			adjustmentCompletedById: shouldResetAdjustmentTracking ? null : line.adjustmentCompletedById,
			adjustmentCompletedAt: shouldResetAdjustmentTracking ? null : line.adjustmentCompletedAt,
			countedById: data.userId,
			countedAt: nowISO(),
			notes: nextNotes,
			updatedAt: nowISO()
		})
		.where(eq(inventoryCountLines.id, line.id));

	const updatedLines = await getSessionLines(data.sessionId, 'ALL', executor);
	const updatedLine = updatedLines.find((candidate) => candidate.id === line.id);

	if (!updatedLine) {
		throw new Error('No se pudo recargar la línea actualizada');
	}

	return updatedLine;
}

export async function setLineAdjustmentStatus(
	data: SetCountLineAdjustmentStatusInput,
	executor: DbOrTx = db
): Promise<InventoryCountLineRow> {
	const [line] = await executor
		.select()
		.from(inventoryCountLines)
		.where(eq(inventoryCountLines.id, data.lineId))
		.limit(1);

	if (!line) {
		throw new Error('La línea de conteo no existe');
	}

	const [session] = await executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.id, line.sessionId))
		.limit(1);

	if (!session) {
		throw new Error('La sesión de conteo no existe');
	}

	if (session.status === 'CANCELLED') {
		throw new Error('No se puede marcar ajustes en una sesión cancelada');
	}

	if (line.countedStock === null || (line.difference ?? 0) === 0) {
		throw new Error('Solo se pueden marcar líneas con diferencia');
	}

	await executor
		.update(inventoryCountLines)
		.set({
			adjustmentCompleted: data.adjustmentCompleted,
			adjustmentCompletedById: data.adjustmentCompleted ? data.userId : null,
			adjustmentCompletedAt: data.adjustmentCompleted ? nowISO() : null,
			updatedAt: nowISO()
		})
		.where(eq(inventoryCountLines.id, data.lineId));

	const updatedLines = await getSessionLines(line.sessionId, 'ALL', executor);
	const updatedLine = updatedLines.find((candidate) => candidate.id === line.id);

	if (!updatedLine) {
		throw new Error('No se pudo recargar la línea actualizada');
	}

	return updatedLine;
}

export async function applySession(
	id: number,
	userId: string,
	executor: DbOrTx = db
): Promise<InventoryCountSessionDetail> {
	if (executor === db) {
		return db.transaction(async (tx) => applySession(id, userId, tx));
	}

	const [actor] = await executor
		.select({ id: users.id, role: users.role })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!actor) {
		throw new Error('Usuario no encontrado');
	}

	if (![UserRole.ADMIN, UserRole.MANAGER].includes(actor.role)) {
		throw new Error('Solo ADMIN o MANAGER pueden aplicar ajustes');
	}

	const [session] = await executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.id, id))
		.limit(1);
	requireOpenSession(session);

	const countedLines = await executor
		.select()
		.from(inventoryCountLines)
		.where(and(eq(inventoryCountLines.sessionId, id), isNotNull(inventoryCountLines.countedStock)));

	if (countedLines.length === 0) {
		throw new Error('No se puede aplicar una sesión sin ítems contados');
	}

	const totalAdjustmentsIn = countedLines.filter((line) => (line.difference ?? 0) > 0).length;
	const totalAdjustmentsOut = countedLines.filter((line) => (line.difference ?? 0) < 0).length;
	const totalMatches = countedLines.filter((line) => (line.difference ?? 0) === 0).length;

	await executor
		.update(inventoryCountSessions)
		.set({
			status: 'APPLIED',
			appliedById: userId,
			appliedAt: nowISO(),
			totalItemsCounted: countedLines.length,
			totalAdjustmentsIn,
			totalAdjustmentsOut,
			totalMatches,
			updatedAt: nowISO()
		})
		.where(eq(inventoryCountSessions.id, id));

	const updated = await getSessionById(id, executor);
	if (!updated) {
		throw new Error('No se pudo cargar la sesión aplicada');
	}

	return updated;
}
