/**
 * Conteo Físico — costos FIFO para clasificar diferencias con umbral USD
 * y estimar el impacto en el informe. Reutiliza las queries de lotes.
 */
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
}

/**
 * Mapa línea → costo FIFO (lote activo más antiguo) solo para líneas con
 * diferencia ≠ 0. Cache por ítem para no repetir consultas del mismo ítem.
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
