import { describe, expect, it } from 'vitest';
import { planStockRefresh, type StockRefreshLine } from './countStockRefresh';

describe('planStockRefresh', () => {
	const line = (overrides: Partial<StockRefreshLine> = {}): StockRefreshLine => ({
		id: 1,
		systemStock: 5,
		countedStock: null,
		recountedStock: null,
		liveStock: 5,
		...overrides
	});

	it('solo actualiza las líneas cuyo stock vivo difiere del snapshot', () => {
		const plan = planStockRefresh([
			line({ id: 1, systemStock: 5, liveStock: 5 }), // igual → intacta
			line({ id: 2, systemStock: 7, liveStock: 4 }), // cambió → se actualiza
			line({ id: 3, systemStock: 0, liveStock: 2 }) // repuso → se actualiza
		]);
		expect(plan.updates).toEqual([
			{ id: 2, newStock: 4 },
			{ id: 3, newStock: 2 }
		]);
	});

	it('cuenta como «limpiada» solo la que cambia y tenía conteo escrito', () => {
		const plan = planStockRefresh([
			line({ id: 1, systemStock: 5, liveStock: 4, countedStock: 5 }), // cambia con conteo
			line({ id: 2, systemStock: 5, liveStock: 4, countedStock: null }), // cambia sin conteo
			line({ id: 3, systemStock: 5, liveStock: 4, countedStock: 3, recountedStock: 2 }), // recuento
			line({ id: 4, systemStock: 5, liveStock: 4, adjustmentRequestedAt: '2026-11-11' }), // solicitud
			line({ id: 5, systemStock: 5, liveStock: 5, countedStock: 5 }) // no cambia, con conteo
		]);
		expect(plan.clearedCounts).toBe(3);
		expect(plan.updates).toHaveLength(4);
	});

	it('sin cambios → updates vacío y nada que limpiar', () => {
		expect(planStockRefresh([line(), line({ id: 2 })])).toEqual({
			updates: [],
			clearedCounts: 0
		});
		expect(planStockRefresh([])).toEqual({ updates: [], clearedCounts: 0 });
	});
});
