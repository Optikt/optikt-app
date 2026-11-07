/**
 * Conteo Físico — ajuste de stock vinculado a la línea.
 * Reutiliza la lógica de ajuste manual (lotes, movimiento, contador de stock
 * en `inventoryLots.applyManualAdjustment`) y vincula el movimiento creado
 * con la línea. Reglas: solo sesión OPEN, diferencia ≠ 0 y sin ajuste previo
 * («Ajustado» significa que existe el movimiento vinculado).
 */
import { eq, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import {
	applyManualAdjustment,
	getActiveLensLotsFifo,
	getActiveLotsFifo
} from '$lib/server/db/queries/inventoryLots';
import { inventoryCountLines, inventoryCountSessions } from '$lib/server/db/schema';
import { lensCatalogItems } from '$lib/server/db/schema';
import { ADJUSTMENT_REASON_LABELS, AdjustmentReason } from '$lib/shared/enums';
import type { InventoryCountLine, InventoryLot } from '$lib/server/db/schema';
import { getLineById, requireLineById } from './lines';
import { getCountCycleConfig } from './sessions';
import { buildLineCostMap } from './costs';
import type { CountLineRow } from './types';

export interface ApplyCountLineAdjustmentInput {
	lineId: number;
	reason: AdjustmentReason;
	reasonText: string | null;
	userId: string;
}

/** Ajusta el stock de una línea con diferencia y vincula el movimiento. */
export async function applyCountLineAdjustment(
	data: ApplyCountLineAdjustmentInput,
	executor: DbOrTx = db
): Promise<CountLineRow> {
	if (executor === db) {
		return db.transaction((tx) => applyCountLineAdjustment(data, tx));
	}

	const line = await requireLineById(data.lineId, executor);
	await requireOpenForAdjustment(line, executor);

	const final = line.recountedStock ?? line.countedStock;
	if (final == null) throw new Error('La línea todavía no está contada');
	const diff = final - line.systemStock;
	if (diff === 0) throw new Error('La línea coincide con el sistema: no hay nada que ajustar');
	if (line.adjustmentMovementId != null) {
		throw new Error('Esta línea ya tiene un ajuste aplicado');
	}

	const notes = `Conteo físico: ${ADJUSTMENT_REASON_LABELS[data.reason]}${
		data.reasonText ? ` — ${data.reasonText}` : ''
	}`;

	let movementId: string;
	if (line.itemType === 'PRODUCT' && line.productId != null) {
		const lot = await findAdjustmentLot(await getActiveLotsFifo(line.productId, executor), diff);
		const created = await applyManualAdjustment(
			{ lotId: lot.id, quantityDelta: diff, notes, createdById: data.userId },
			executor
		);
		movementId = created.movement.id;
	} else if (line.itemType === 'LENS' && line.lensCatalogItemId != null) {
		const lot = await findAdjustmentLot(
			await getActiveLensLotsFifo(line.lensCatalogItemId, executor),
			diff
		);
		const created = await applyManualAdjustment(
			{ lotId: lot.id, quantityDelta: diff, notes, createdById: data.userId },
			executor
		);
		movementId = created.movement.id;
		// El ajuste manual actualiza el contador de productos, no el de lentes.
		await executor
			.update(lensCatalogItems)
			.set({ stock: sql`coalesce(${lensCatalogItems.stock}, 0) + ${diff}` })
			.where(eq(lensCatalogItems.id, line.lensCatalogItemId));
	} else {
		throw new Error('La línea no tiene un ítem ajustable');
	}

	const now = new Date().toISOString();
	await executor
		.update(inventoryCountLines)
		.set({
			adjustmentMovementId: movementId,
			adjustmentReason: data.reason,
			adjustmentReasonText: data.reasonText ?? null,
			adjustmentCompleted: true,
			adjustmentCompletedById: data.userId,
			adjustmentCompletedAt: now,
			updatedAt: now
		})
		.where(eq(inventoryCountLines.id, line.id));

	const updated = await getLineById(line.id, executor);
	if (!updated) throw new Error('No se pudo recargar la línea ajustada');
	return updated;
}

function findAdjustmentLot(lots: InventoryLot[], diff: number): InventoryLot {
	const lot = lots[0];
	if (!lot) {
		throw new Error(
			diff > 0
				? 'No hay lote activo para registrar una entrada: ajusta en la ficha del ítem'
				: 'No hay lote activo con stock para registrar la salida'
		);
	}
	if (diff < 0 && lot.quantityAvailable < Math.abs(diff)) {
		throw new Error(
			`El lote activo tiene ${lot.quantityAvailable} unidades y el ajuste requiere ${Math.abs(diff)}: ajusta por lotes en la ficha del ítem`
		);
	}
	return lot;
}

async function requireOpenForAdjustment(line: InventoryCountLine, executor: DbOrTx): Promise<void> {
	const [session] = await executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.id, line.sessionId))
		.limit(1);
	if (session?.status === 'CANCELLED') {
		throw new Error('No se pueden registrar ajustes en una sesión cancelada');
	}
	if (session?.status !== 'OPEN') {
		throw new Error('Los ajustes se aplican dentro de la sesión abierta');
	}
}

/**
 * «Aplicar todo (N)»: ajusta todas las diferencias bajo los umbrales
 * (unidades y USD) que no tengan ajuste ni recuento pendiente. Falla completa
 * si alguna línea falla (transacción compartida).
 */
export async function applyAdjustmentsBatch(
	sessionId: number,
	reason: AdjustmentReason,
	reasonText: string | null,
	userId: string,
	executor: DbOrTx = db
): Promise<number> {
	if (executor === db) {
		return db.transaction((tx) => applyAdjustmentsBatch(sessionId, reason, reasonText, userId, tx));
	}

	const [session] = await executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.id, sessionId))
		.limit(1);
	if (!session) throw new Error('Sesión de conteo no encontrada');
	if (session.status !== 'OPEN') throw new Error('La sesión ya no está abierta');

	const [config, lines, costs] = await Promise.all([
		getCountCycleConfig(),
		executor.select().from(inventoryCountLines).where(eq(inventoryCountLines.sessionId, sessionId)),
		buildLineCostMap(
			await executor
				.select()
				.from(inventoryCountLines)
				.where(eq(inventoryCountLines.sessionId, sessionId)),
			executor
		)
	]);

	const candidates = lines.filter((line) => {
		const final = line.recountedStock ?? line.countedStock;
		if (final == null) return false;
		const diff = final - line.systemStock;
		if (diff === 0) return false;
		if (line.adjustmentMovementId != null) return false;
		if (Math.abs(diff) >= config.diffThresholdUnits) return false;
		const cost = costs.get(line.id);
		if (
			config.diffThresholdUsd > 0 &&
			cost != null &&
			Math.abs(diff * cost) >= config.diffThresholdUsd
		) {
			return false;
		}
		return true;
	});

	for (const line of candidates) {
		await applyCountLineAdjustment({ lineId: line.id, reason, reasonText, userId }, executor);
	}
	return candidates.length;
}
