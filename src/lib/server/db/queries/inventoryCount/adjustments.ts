/**
 * Conteo Físico — solicitud de ajuste vinculada a la línea.
 * En la fase Revisar solo se MARCA la línea (motivo + solicitante); el
 * movimiento de inventario se crea al cerrar la sesión (`applySession`, dentro
 * de su transacción). Así cancelar la sesión descarta cualquier ajuste y nunca
 * queda stock movido por un conteo que no se aplicó.
 * Reglas: solo sesión OPEN, diferencia ≠ 0 y sin movimiento previo.
 * «Ajustado» = existe el movimiento vinculado (siempre post-cierre).
 */
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

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

export interface RequestCountLineAdjustmentInput {
	lineId: number;
	reason: AdjustmentReason;
	reasonText: string | null;
	userId: string;
}

/**
 * Marca la línea con la solicitud de ajuste (sin crear movimiento). Un guardar
 * repetido re-marca con el motivo actual. UPDATE con guard atómico `OPEN`:
 * si la sesión se cerró entre la lectura y la escritura, no se modifica nada.
 */
export async function requestCountLineAdjustment(
	data: RequestCountLineAdjustmentInput,
	executor: DbOrTx = db
): Promise<CountLineRow> {
	if (executor === db) {
		// Tx: el FOR UPDATE de la sesión debe sostenerse hasta el UPDATE (serializa
		// con un cierre concurrente: si gana el cierre, este pedido falla).
		return db.transaction((tx) => requestCountLineAdjustment(data, tx));
	}
	const line = await requireLineById(data.lineId, executor);
	await requireOpenForAdjustment(line, executor);

	// D12.6: motivo «Otros» exige texto libero (regla de negocio en server).
	if (data.reason === AdjustmentReason.OTHER && !data.reasonText?.trim()) {
		throw new Error('Escribe el motivo');
	}

	const final = line.recountedStock ?? line.countedStock;
	if (final == null) throw new Error('La línea todavía no está contada');
	const diff = final - line.systemStock;
	if (diff === 0) throw new Error('La línea coincide con el sistema: no hay nada que ajustar');
	if (line.adjustmentMovementId != null) {
		throw new Error('Esta línea ya tiene un ajuste aplicado');
	}

	// Chequeo temprano de lotes (mismo criterio que la ejecución): es mejor
	// fallar aquí que al cierre. Puede quedar obsoleto si el stock cambia después.
	await requireAdjustmentLot(line, diff, executor);

	const now = new Date().toISOString();
	const requested = await executor
		.update(inventoryCountLines)
		.set({
			adjustmentReason: data.reason,
			adjustmentReasonText: data.reasonText ?? null,
			adjustmentRequestedBy: data.userId,
			adjustmentRequestedAt: now,
			updatedAt: now
		})
		.where(
			and(
				eq(inventoryCountLines.id, line.id),
				// `system_stock` es mutable en OPEN («Refrescar stock»): si cambió,
				// el diff de esta solicitud sería contra la referencia vieja.
				eq(inventoryCountLines.systemStock, line.systemStock),
				isNull(inventoryCountLines.adjustmentMovementId),
				sql`exists (
					select 1 from ${inventoryCountSessions}
					where ${inventoryCountSessions.id} = ${inventoryCountLines.sessionId}
						and ${inventoryCountSessions.status} = 'OPEN'
				)`
			)
		)
		.returning({ id: inventoryCountLines.id });
	if (requested.length === 0) {
		const fresh = await getLineById(line.id, executor);
		if (fresh?.adjustmentMovementId != null) {
			throw new Error('Esta línea ya tiene un ajuste aplicado');
		}
		if (fresh && fresh.countedStock == null) {
			throw new Error('La línea todavía no está contada');
		}
		if (fresh && fresh.systemStock !== line.systemStock) {
			throw new Error(
				'El stock del sistema cambió mientras revisabas: la línea se recargó, vuelve a solicitar el ajuste'
			);
		}
		throw new Error('La sesión ya no está abierta');
	}

	const updated = await getLineById(line.id, executor);
	if (!updated) throw new Error('No se pudo recargar la línea solicitada');
	return updated;
}

/** Quita la solicitud (la línea vuelve a «Ajustar»). Solo con sesión OPEN. */
export async function clearLineAdjustmentRequest(
	lineId: number,
	executor: DbOrTx = db
): Promise<CountLineRow> {
	if (executor === db) {
		return db.transaction((tx) => clearLineAdjustmentRequest(lineId, tx));
	}
	const line = await requireLineById(lineId, executor);
	await requireOpenForAdjustment(line, executor);
	if (line.adjustmentMovementId != null) {
		throw new Error('Esta línea ya tiene el ajuste aplicado');
	}
	if (line.adjustmentRequestedAt == null) {
		throw new Error('Esta línea no tiene un ajuste solicitado');
	}

	const now = new Date().toISOString();
	const cleared = await executor
		.update(inventoryCountLines)
		.set({
			adjustmentReason: null,
			adjustmentReasonText: null,
			adjustmentRequestedBy: null,
			adjustmentRequestedAt: null,
			updatedAt: now
		})
		.where(
			and(
				eq(inventoryCountLines.id, line.id),
				isNull(inventoryCountLines.adjustmentMovementId),
				sql`exists (
					select 1 from ${inventoryCountSessions}
					where ${inventoryCountSessions.id} = ${inventoryCountLines.sessionId}
						and ${inventoryCountSessions.status} = 'OPEN'
				)`
			)
		)
		.returning({ id: inventoryCountLines.id });
	if (cleared.length === 0) {
		const fresh = await getLineById(line.id, executor);
		if (fresh?.adjustmentMovementId != null)
			throw new Error('Esta línea ya tiene el ajuste aplicado');
		if (fresh?.adjustmentRequestedAt == null) {
			throw new Error('Esta línea no tiene un ajuste solicitado');
		}
		throw new Error('La sesión ya no está abierta');
	}

	const updated = await getLineById(line.id, executor);
	if (!updated) throw new Error('No se pudo recargar la línea');
	return updated;
}

/**
 * Crea el movimiento de una solicitud válida y vincula la línea.
 * Solo la llama `applySession` (dentro de su transacción): no valida estado de
 * sesión porque la sesión está en proceso de cierre. Líneas sin contar o cuya
 * diferencia se anuló no son error → se omiten.
 */
export async function executeCountLineAdjustment(
	line: InventoryCountLine,
	userId: string,
	executor: DbOrTx
): Promise<void> {
	if (executor === db) {
		return db.transaction((tx) => executeCountLineAdjustment(line, userId, tx));
	}
	if (line.adjustmentRequestedAt == null || line.adjustmentMovementId != null) return;
	const final = line.recountedStock ?? line.countedStock;
	if (final == null) return;
	const diff = final - line.systemStock;
	if (diff === 0) return;

	const reason = (line.adjustmentReason ?? '') as AdjustmentReason;
	const label = ADJUSTMENT_REASON_LABELS[reason];
	if (!label) throw new Error('La solicitud de ajuste no tiene un motivo válido');
	const notes = `Conteo físico: ${label}${
		line.adjustmentReasonText ? ` — ${line.adjustmentReasonText}` : ''
	}`;

	let movementId: string;
	try {
		if (line.itemType === 'PRODUCT' && line.productId != null) {
			const lot = findAdjustmentLot(await getActiveLotsFifo(line.productId, executor), diff);
			const created = await applyManualAdjustment(
				{ lotId: lot.id, quantityDelta: diff, notes, createdById: userId },
				executor
			);
			movementId = created.movement.id;
		} else if (line.itemType === 'LENS' && line.lensCatalogItemId != null) {
			const lot = findAdjustmentLot(
				await getActiveLensLotsFifo(line.lensCatalogItemId, executor),
				diff
			);
			const created = await applyManualAdjustment(
				{ lotId: lot.id, quantityDelta: diff, notes, createdById: userId },
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
	} catch (error) {
		// El cierre no puede fallar sin decir cómo salir: la solicitud se quita (✕)
		// o se re-cuenta; nada de stock se movió (esta tx revierte completa).
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(
			`No se pudo ejecutar el ajuste al cerrar: ${detail}. Quita la solicitud (✕) de la línea para poder cerrar.`,
			{ cause: error }
		);
	}

	// Guard atómico: si la solicitud se quitó o cambió entre la lectura de la
	// sesión y aquí (upsert/recuento concurrente), 0 filas → revierte TODO
	// (incluido el movement recién escrito en esta transacción).
	const now = new Date().toISOString();
	const executed = await executor
		.update(inventoryCountLines)
		.set({
			adjustmentMovementId: movementId,
			adjustmentCompleted: true,
			adjustmentCompletedById: userId,
			adjustmentCompletedAt: now,
			updatedAt: now
		})
		.where(
			and(
				eq(inventoryCountLines.id, line.id),
				isNotNull(inventoryCountLines.adjustmentRequestedAt),
				isNull(inventoryCountLines.adjustmentMovementId)
			)
		)
		.returning({ id: inventoryCountLines.id });
	if (executed.length === 0) {
		throw new Error(
			'La solicitud de ajuste cambió durante el cierre: revisa la línea y vuelve a cerrar'
		);
	}
}

/** Valida que exista un lote apto para el diff (solo lectura, sin escribir). */
async function requireAdjustmentLot(
	line: InventoryCountLine,
	diff: number,
	executor: DbOrTx
): Promise<void> {
	if (line.itemType === 'PRODUCT' && line.productId != null) {
		findAdjustmentLot(await getActiveLotsFifo(line.productId, executor), diff);
	} else if (line.itemType === 'LENS' && line.lensCatalogItemId != null) {
		findAdjustmentLot(await getActiveLensLotsFifo(line.lensCatalogItemId, executor), diff);
	} else {
		throw new Error('La línea no tiene un ítem ajustable');
	}
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
		.limit(1)
		.for('update');
	if (session?.status === 'CANCELLED') {
		throw new Error('No se pueden solicitar ajustes en una sesión cancelada');
	}
	if (session?.status !== 'OPEN') {
		throw new Error('Los ajustes se solicitan dentro de la sesión abierta');
	}
}

/**
 * «Ajustar todo (N)»: marca todas las diferencias bajo los umbrales
 * (unidades y USD) que no tengan movimiento, solicitud ni recuento pendiente.
 * Falla completa si alguna falla (transacción compartida). Los movimientos se
 * crean al cerrar la sesión.
 */
export async function requestAdjustmentsBatch(
	sessionId: number,
	reason: AdjustmentReason,
	reasonText: string | null,
	userId: string,
	executor: DbOrTx = db
): Promise<number> {
	if (executor === db) {
		return db.transaction((tx) =>
			requestAdjustmentsBatch(sessionId, reason, reasonText, userId, tx)
		);
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
		// Ya solicitadas: «Ajustar todo» solo marca las que faltan.
		if (line.adjustmentRequestedAt != null) return false;
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
		await requestCountLineAdjustment({ lineId: line.id, reason, reasonText, userId }, executor);
	}
	return candidates.length;
}
