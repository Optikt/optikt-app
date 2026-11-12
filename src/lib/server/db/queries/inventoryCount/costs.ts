/**
 * Conteo Físico — costos FIFO para clasificar diferencias con umbral USD
 * y estimar el impacto en el informe. Reutiliza las queries de lotes.
 */
import { sql } from 'drizzle-orm';

import { getNextFifoCost, getActiveLensLotsFifo } from '$lib/server/db/queries/inventoryLots';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';

export interface InventoryCountLineLike {
	id: number;
	itemType: string;
	productId: string | null;
	lensCatalogItemId: string | null;
	countedStock: number | null;
	recountedStock: number | null;
	systemStock: number;
	/** Costo FIFO congelado al cerrar/cancelar (los callers pasan filas completas). */
	fifoCostUsd: number | null;
}

/**
 * Mapa línea → costo FIFO (lote activo más antiguo) solo para líneas con
 * diferencia ≠ 0. Cache por ítem para no repetir consultas del mismo ítem.
 * Si la línea ya tiene `fifoCostUsd` congelado (sesión cerrada/cancelada) se
 * usa ese: el informe no depende del stock vivo. `null` congelado o sesión
 * OPEN → lookup FIFO vivo.
 */
export async function buildLineCostMap(
	lines: InventoryCountLineLike[],
	executor: DbOrTx = db
): Promise<Map<number, number | null>> {
	const map = new Map<number, number | null>();
	const productCost = new Map<string, number | null>();
	const lensCostCache = new Map<string, number | null>();

	for (const line of lines) {
		const final = line.recountedStock ?? line.countedStock;
		if (final == null || final - line.systemStock === 0) continue;

		if (line.fifoCostUsd != null) {
			// Costo congelado al cerrar/cancelar: estable y sin queries.
			map.set(line.id, line.fifoCostUsd);
			continue;
		}

		if (line.itemType === 'PRODUCT' && line.productId) {
			if (!productCost.has(line.productId)) {
				productCost.set(line.productId, await getNextFifoCost(line.productId, executor));
			}
			map.set(line.id, productCost.get(line.productId) ?? null);
		} else if (line.itemType === 'LENS' && line.lensCatalogItemId) {
			if (!lensCostCache.has(line.lensCatalogItemId)) {
				const lots = await getActiveLensLotsFifo(line.lensCatalogItemId, executor);
				lensCostCache.set(line.lensCatalogItemId, lots[0]?.unitPurchasePrice ?? null);
			}
			map.set(line.id, lensCostCache.get(line.lensCatalogItemId) ?? null);
		}
	}

	return map;
}

/**
 * Congela los costos de varias líneas en UNA sola sentencia: evita N
 * roundtrips dentro de la transacción de cierre/cancelación (que sostiene el
 * lock FOR UPDATE de la sesión). Sin costos → no-op.
 */
export async function persistFrozenCosts(
	entries: ReadonlyArray<readonly [number, number]>,
	executor: DbOrTx
): Promise<void> {
	if (entries.length === 0) return;
	const rows = entries.map(
		([lineId, cost]) => sql`(${lineId}::integer, ${cost}::double precision)`
	);
	await executor.execute(sql`
		update inventory_count_lines as l
		set fifo_cost_usd = v.cost
		from (values ${sql.join(rows, sql`, `)}) as v(id, cost)
		where l.id = v.id
	`);
}
