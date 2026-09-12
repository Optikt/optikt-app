/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: count lines.
 */
import type {
	InventoryCountLineFilter,
	InventoryCountLineRow,
	SetCountLineAdjustmentStatusInput,
	UpsertCountLineInput
} from './types';
import { requireOpenSession, buildSessionLineFilter, normalizeSessionNotes } from './shared';
// NOTE: circular with ./sessions by design — used lazily inside function bodies only.
import { getSessionById } from './sessions';
import { and, asc, eq, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';

import {
	inventoryCountLines,
	inventoryCountSessions,
	lensCatalogItems,
	products,
	users
} from '$lib/server/db/schema';
import { nowISO } from '$lib/dates';

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
