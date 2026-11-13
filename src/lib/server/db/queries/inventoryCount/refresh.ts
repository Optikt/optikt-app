/**
 * Conteo Físico — «Refrescar stock»: re-sincroniza `system_stock` con el stock
 * vivo (products.stock / lens_catalog_items.stock) durante una sesión OPEN.
 *
 * Motivo: el snapshot se congela al crear la sesión y una venta editada afuera
 * deja el stock de referencia viejo → diferencias falsas y malos ajustes al
 * cerrar. Solo se actualizan las líneas cuyo stock **realmente cambió**; las
 * demás quedan intactas (los conteos escritos no se tocan). Las que cambian
 * pierden todo lo derivado (contaban contra la referencia vieja) y quedan
 * pendientes, lo que bloquea el avance hasta recontarlas.
 */
import { eq, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import { inventoryCountLines, lensCatalogItems, products } from '$lib/server/db/schema';
import {
	planStockRefresh,
	type StockRefreshLine,
	type StockRefreshUpdate
} from '$lib/shared/countStockRefresh';
import { requireOpenSession } from './shared';
import { getSessionRow } from './sessions';

export interface StockRefreshPreview {
	/** Total de líneas de la sesión. */
	totalLines: number;
	/** Líneas que recibirán un `system_stock` nuevo. */
	updatedLines: number;
	/** De las que cambian, cuántas pierden su conteo (habrá que recontarlas). */
	clearedCounts: number;
	/** Líneas que no cambian: sus conteos quedan intactos. */
	untouchedLines: number;
}

function toPreview(
	totalLines: number,
	updates: number,
	clearedCounts: number
): StockRefreshPreview {
	return {
		totalLines,
		updatedLines: updates,
		clearedCounts,
		untouchedLines: totalLines - updates
	};
}

/**
 * Stock vivo por línea de la sesión (un solo join: products + lentes). Un
 * producto borrado conserva su último stock (no se inventa un 0).
 */
async function loadRefreshLines(sessionId: number, executor: DbOrTx): Promise<StockRefreshLine[]> {
	const rows = await executor
		.select({
			id: inventoryCountLines.id,
			itemType: inventoryCountLines.itemType,
			systemStock: inventoryCountLines.systemStock,
			countedStock: inventoryCountLines.countedStock,
			recountedStock: inventoryCountLines.recountedStock,
			adjustmentRequestedAt: inventoryCountLines.adjustmentRequestedAt,
			productStock: products.stock,
			lensStock: lensCatalogItems.stock
		})
		.from(inventoryCountLines)
		.leftJoin(products, eq(inventoryCountLines.productId, products.id))
		.leftJoin(lensCatalogItems, eq(inventoryCountLines.lensCatalogItemId, lensCatalogItems.id))
		.where(eq(inventoryCountLines.sessionId, sessionId));

	return rows.map((row) => ({
		id: row.id,
		systemStock: row.systemStock,
		countedStock: row.countedStock,
		recountedStock: row.recountedStock,
		adjustmentRequestedAt: row.adjustmentRequestedAt,
		liveStock: row.itemType === 'LENS' ? (row.lensStock ?? 0) : (row.productStock ?? 0)
	}));
}

/** Solo lectura: cuánto cambiaría el refresh (para el modal de confirmación). */
export async function previewSessionStockRefresh(
	sessionId: number,
	executor: DbOrTx = db
): Promise<StockRefreshPreview> {
	// Sin lock (es lectura), pero valida OPEN: el modal no debería ofrecer
	// refrescar una sesión que ya se cerró (p. ej. cierre concurrente).
	const session = await getSessionRow(sessionId, executor);
	requireOpenSession(session);
	const lines = await loadRefreshLines(sessionId, executor);
	const plan = planStockRefresh(lines);
	return toPreview(lines.length, plan.updates.length, plan.clearedCounts);
}

/**
 * Ejecuta el refresh en una transacción: bloquea la sesión (`FOR UPDATE`),
 * valida OPEN y actualiza en UNA sola sentencia las líneas cuyo stock cambió,
 * limpiando en el mismo `SET` todo lo derivado (el conteo se hizo contra la
 * referencia vieja). `fifo_cost_usd` no se toca: en una sesión OPEN es null
 * (solo se congela al cerrar/cancelar).
 */
export async function refreshSessionStock(
	sessionId: number,
	executor: DbOrTx = db
): Promise<StockRefreshPreview> {
	if (executor === db) {
		return db.transaction((tx) => refreshSessionStock(sessionId, tx));
	}

	const session = await getSessionRow(sessionId, executor, { lock: true });
	requireOpenSession(session);

	const lines = await loadRefreshLines(sessionId, executor);
	const plan = planStockRefresh(lines);
	if (plan.updates.length === 0) {
		return toPreview(lines.length, 0, 0);
	}

	await persistRefreshedStocks(sessionId, plan.updates, executor);
	return toPreview(lines.length, plan.updates.length, plan.clearedCounts);
}

/**
 * Un solo `UPDATE … FROM (VALUES …)`: evita N roundtrips con el lock puesto
 * (patrón de `persistFrozenCosts`). El `IS DISTINCT FROM` es un segundo guard:
 * si otra transacción ya puso ese valor, no se repite la limpieza.
 */
async function persistRefreshedStocks(
	sessionId: number,
	updates: readonly StockRefreshUpdate[],
	executor: DbOrTx
): Promise<void> {
	const rows = updates.map((entry) => sql`(${entry.id}::integer, ${entry.newStock}::integer)`);
	const now = new Date().toISOString();
	await executor.execute(sql`
		update inventory_count_lines as l
		set system_stock = v.new_stock,
			counted_stock = null,
			counted_by_id = null,
			counted_at = null,
			difference = null,
			recounted_stock = null,
			recounted_by_id = null,
			recounted_at = null,
			adjustment_movement_id = null,
			adjustment_completed = false,
			adjustment_completed_by_id = null,
			adjustment_completed_at = null,
			adjustment_reason = null,
			adjustment_reason_text = null,
			adjustment_requested_by = null,
			adjustment_requested_at = null,
			updated_at = ${now}::timestamptz
		from (values ${sql.join(rows, sql`, `)}) as v(id, new_stock)
		where l.id = v.id
			and l.session_id = ${sessionId}::integer
			and l.system_stock is distinct from v.new_stock
	`);
}
