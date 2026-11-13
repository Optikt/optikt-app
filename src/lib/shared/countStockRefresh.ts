/**
 * Conteo Físico — lógica pura del «Refrescar stock»: decide qué líneas de la
 * sesión reciben un `system_stock` nuevo y cuántas pierden su conteo.
 * Módulo aparte de `inventoryCount.ts` para no pasar el size gate DT1.
 */

// ── Refresco del stock de la sesión ─────────────────────────────────────────

export interface StockRefreshLine {
	id: number;
	systemStock: number;
	countedStock: number | null;
	recountedStock: number | null;
	adjustmentRequestedAt?: string | null;
	/** Stock vivo del ítem ahora (products.stock / lens_catalog_items.stock). */
	liveStock: number;
}

export interface StockRefreshUpdate {
	id: number;
	newStock: number;
}

export interface StockRefreshPlan {
	/** Líneas cuyo stock vivo difiere del snapshot: reciben `system_stock` nuevo. */
	updates: StockRefreshUpdate[];
	/** De las que cambian, cuántas tenían conteo/recuento/solicitud (se limpian). */
	clearedCounts: number;
}

/**
 * Decide qué líneas de la sesión se tocan al «Refrescar stock».
 *
 * Solo cambia `system_stock` donde el stock vivo difiere del snapshot; las
 * líneas que **no** cambian no se tocan (los conteos escritos quedan intactos).
 * Las que cambian pierden todo lo derivado —su conteo se hizo contra la
 * referencia vieja— y quedan pendientes de nuevo, lo que bloquea el avance a
 * Revisar hasta recontarlas.
 */
export function planStockRefresh(lines: readonly StockRefreshLine[]): StockRefreshPlan {
	const updates: StockRefreshUpdate[] = [];
	let clearedCounts = 0;
	for (const line of lines) {
		if (line.liveStock === line.systemStock) continue;
		updates.push({ id: line.id, newStock: line.liveStock });
		if (
			line.countedStock != null ||
			line.recountedStock != null ||
			line.adjustmentRequestedAt != null
		) {
			clearedCounts += 1;
		}
	}
	return { updates, clearedCounts };
}
