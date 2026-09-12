/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: session lifecycle.
 */
import type {
	GetInventoryCountSessionsOptions,
	InventoryCountSessionDetail,
	InventoryCountSessionSummary,
	InventoryCountSnapshotInput
} from './types';
import {
	requireOpenSession,
	normalizeSessionNotes,
	enrichSessions,
	createSnapshotLines
} from './shared';
// NOTE: circular with ./lines by design — both used lazily inside function bodies only.
import { getSessionLines } from './lines';
import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm';

import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import { canCloseInventoryCountSession } from '$lib/schemas/inventoryCount';
import { inventoryCountLines, inventoryCountSessions, users } from '$lib/server/db/schema';
import { fromISODate, nowISO, toEndOfDay, toUTCString } from '$lib/dates';
import { UserRole } from '$lib/shared/enums';

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
	options: GetInventoryCountSessionsOptions = {},
	executor: DbOrTx = db
): Promise<InventoryCountSessionSummary[]> {
	const { limit = 20, scopeType, openedOn } = options;
	const conditions: SQL[] = [];

	if (scopeType) {
		conditions.push(eq(inventoryCountSessions.scopeType, scopeType));
	}

	if (openedOn) {
		const openedOnDate = fromISODate(openedOn);
		if (openedOnDate) {
			conditions.push(gte(inventoryCountSessions.openedAt, toUTCString(openedOnDate)));
			conditions.push(lte(inventoryCountSessions.openedAt, toUTCString(toEndOfDay(openedOnDate))));
		}
	}

	const sessions = conditions.length
		? await executor
				.select()
				.from(inventoryCountSessions)
				.where(and(...conditions))
				.orderBy(desc(inventoryCountSessions.openedAt))
				.limit(limit)
		: await executor
				.select()
				.from(inventoryCountSessions)
				.orderBy(desc(inventoryCountSessions.openedAt))
				.limit(limit);

	return enrichSessions(sessions, executor);
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

	const sessionLines = await executor
		.select()
		.from(inventoryCountLines)
		.where(eq(inventoryCountLines.sessionId, id));

	const countedLines = sessionLines.filter((line) => line.countedStock !== null);

	if (!canCloseInventoryCountSession(sessionLines.length, countedLines.length)) {
		throw new Error('Debes contar o confirmar todos los ítems antes de cerrar la sesión');
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
