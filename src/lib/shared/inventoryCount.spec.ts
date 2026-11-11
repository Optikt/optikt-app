import { describe, expect, it } from 'vitest';
import {
	canCloseSession,
	computeCountStats,
	diffGravity,
	finalCount,
	formatSignedInteger,
	isNewUnverified,
	lineDiff,
	medianOf,
	requiresRecount,
	summarizeCoverage,
	trafficStateByMedianAge,
	trafficStateFor,
	formatUsd,
	formatCountScopeLabel,
	formatAgo,
	statusLabelFor,
	statusVariantFor,
	isLineVerified,
	lineMatchesFilter,
	lineMatchesSearch,
	lineNeedsCost
} from './inventoryCount';
import type { CountLineCore } from './inventoryCount';

const CONFIG = {
	cycleDays: 30,
	diffThresholdUnits: 2,
	diffThresholdUsd: 0,
	quickOldestLimit: 50
};

function line(overrides: Partial<CountLineCore> = {}): CountLineCore {
	return {
		id: 1,
		itemType: 'PRODUCT',
		systemStock: 5,
		countedStock: null,
		recountedStock: null,
		adjustmentMovementId: null,
		...overrides
	};
}

describe('traffic light', () => {
	it('classifies by age relative to the cycle', () => {
		expect(
			trafficStateFor({ lastCountedAt: '2026-11-01T00:00:00.000Z', createdAt: null }, 30)
		).toBe('ok');
	});

	it('never-counted items are gray unless they are brand new', () => {
		expect(trafficStateFor({ lastCountedAt: null, createdAt: null }, 30, Date.now())).toBe('none');
		expect(isNewUnverified({ lastCountedAt: null, createdAt: new Date().toISOString() }, 30)).toBe(
			true
		);
	});

	it('medians drive group semaphore', () => {
		expect(medianOf([10, 5, 20])).toBe(10);
		expect(trafficStateByMedianAge(null, 30)).toBe('none');
		expect(trafficStateByMedianAge(45, 30)).toBe('over');
	});
});

describe('coverage summary', () => {
	it('counts verified / soon / over / never', () => {
		const now = Date.now();
		const summary = summarizeCoverage(
			[
				{ lastCountedAt: new Date(now - 3 * 86_400_000).toISOString(), createdAt: null },
				{ lastCountedAt: new Date(now - 28 * 86_400_000).toISOString(), createdAt: null },
				{ lastCountedAt: new Date(now - 45 * 86_400_000).toISOString(), createdAt: null },
				{ lastCountedAt: null, createdAt: null }
			],
			30,
			now
		);
		expect(summary.okCount).toBe(1);
		expect(summary.soonCount).toBe(1);
		expect(summary.overCount).toBe(1);
		expect(summary.neverCounted).toBe(1);
		expect(summary.verifiedPercent).toBe(25);
	});
});

describe('difference classification', () => {
	it('final count prefers recount', () => {
		expect(finalCount(line({ countedStock: 5, recountedStock: 6 }))).toBe(6);
		expect(lineDiff(line({ systemStock: 5, countedStock: 5, recountedStock: 6 }))).toBe(1);
	});

	it('zero is neutral; small diffs are low; big diffs are high', () => {
		expect(diffGravity(line({ systemStock: 5, countedStock: 5 }), CONFIG)).toBe('match');
		expect(diffGravity(line({ systemStock: 5, countedStock: 6 }), CONFIG)).toBe('low');
		expect(diffGravity(line({ systemStock: 5, countedStock: 8 }), CONFIG)).toBe('high');
	});

	it('USD threshold escalates expensive items', () => {
		const expensive = line({ systemStock: 400, countedStock: 401 });
		// dif = 1 u; con umbral USD 80 y costo 90: 1 × 90 ≥ 80 → grave
		expect(diffGravity(expensive, { ...CONFIG, diffThresholdUsd: 80 }, 90)).toBe('high');
		// costo 70: 1 × 70 < 80 → no escala (y |dif| < 2 unidades)
		expect(diffGravity(expensive, { ...CONFIG, diffThresholdUsd: 80 }, 70)).toBe('low');
	});

	it('requires recount only above threshold without one', () => {
		expect(requiresRecount(line({ systemStock: 5, countedStock: 8 }), CONFIG)).toBe(true);
		expect(
			requiresRecount(line({ systemStock: 5, countedStock: 8, recountedStock: 8 }), CONFIG)
		).toBe(false);
		expect(requiresRecount(line({ systemStock: 5, countedStock: 6 }), CONFIG)).toBe(false);
	});

	it('formats signed integers', () => {
		expect(formatSignedInteger(null)).toBe('—');
		expect(formatSignedInteger(3)).toBe('+3');
		expect(formatSignedInteger(-3)).toBe('-3');
	});
});

describe('stats de ajustes y umbrales', () => {
	it('ajustes aplicados y pendientes se separan por movimiento vinculado', () => {
		const linked = line({ id: 1, systemStock: 5, countedStock: 6, adjustmentMovementId: 'mov-1' });
		const free = line({ id: 2, systemStock: 5, countedStock: 6 });
		const stats = computeCountStats([linked, free], CONFIG);
		expect(stats.adjustmentsApplied).toBe(1);
		expect(stats.adjustmentsPending).toBe(1);
		expect(stats.surplusUnits).toBe(2);
	});

	it('umbral USD activo exige recuento con costo alto aunque unidades sean bajas', () => {
		const expensive = line({ id: 1, systemStock: 400, countedStock: 401 });
		const cfg = { ...CONFIG, diffThresholdUsd: 80 };
		expect(requiresRecount(expensive, cfg, 90)).toBe(true);
		expect(requiresRecount(expensive, cfg, null)).toBe(false);
	});

	it('stats con líneas contadas y ajustes en cero', () => {
		const stats = computeCountStats(
			[line({ id: 1, systemStock: 5, countedStock: 5, recountedStock: 5 })],
			CONFIG
		);
		expect(stats.verified).toBe(1);
		expect(stats.matchCount).toBe(1);
		expect(stats.progressPercent).toBe(100);
		expect(stats.varianceLabel).toBe('Sin variación neta');
	});
});

describe('new closure rule', () => {
	it('blocks with pending counting lines (stock > 0)', () => {
		const stats = computeCountStats(
			[line({ id: 1, systemStock: 5, countedStock: 5 }), line({ id: 2, systemStock: 3 })],
			CONFIG
		);
		expect(stats.pendingCounting).toBe(1);
		expect(canCloseSession(stats)).toBe(false);
	});

	it('does not block with stock 0 unconfirmed — but does not verify them either', () => {
		const stats = computeCountStats(
			[line({ id: 1, systemStock: 5, countedStock: 5 }), line({ id: 2, systemStock: 0 })],
			CONFIG
		);
		expect(stats.zeroStockPending).toBe(1);
		expect(stats.pendingCounting).toBe(0);
		expect(canCloseSession(stats)).toBe(true);
	});

	it('blocks when a big difference lacks recount', () => {
		const stats = computeCountStats([line({ id: 1, systemStock: 5, countedStock: 9 })], CONFIG);
		expect(stats.recountsPending).toBe(1);
		expect(canCloseSession(stats)).toBe(false);
	});

	it('closes cleanly when everything is counted and recounted', () => {
		const stats = computeCountStats(
			[line({ id: 1, systemStock: 5, countedStock: 9, recountedStock: 9 })],
			CONFIG
		);
		expect(canCloseSession(stats)).toBe(true);
	});
});

describe('formatting y helpers restantes', () => {
	it('formatUsd', () => {
		expect(formatUsd(0)).toBe('$0');
		expect(formatUsd(-90)).toBe('−$90');
	});

	it('formatAgo', () => {
		expect(formatAgo(null)).toBe('nunca');
		expect(formatAgo(45)).toBe('hace 45 d');
	});

	it('session status labels/variantes', () => {
		expect(statusLabelFor('OPEN')).toBe('Abierta');
		expect(statusVariantFor('OPEN')).toBe('warning');
		expect(statusVariantFor('APPLIED')).toBe('success');
		expect(statusVariantFor('CANCELLED')).toBe('neutral');
	});

	it('formatCountScopeLabel by dim', () => {
		expect(
			formatCountScopeLabel({ kind: 'QUICK_OLDEST', dim: 'ALL', valueLabels: [], n: 50 })
		).toBe('Los 50 más atrasados');
		expect(
			formatCountScopeLabel({ kind: 'BRAND', dim: 'BRAND', valueLabels: ['Ray-Ban'], n: null })
		).toBe('Marca: Ray-Ban');
		expect(formatCountScopeLabel({ kind: 'ALL', dim: 'ALL', valueLabels: [], n: null })).toBe(
			'Todo el inventario'
		);
	});

	it('isLineVerified usa recuento si existe', () => {
		expect(isLineVerified(line({ systemStock: 4, countedStock: null, recountedStock: 3 }))).toBe(
			true
		);
	});
});

describe('filter y búsqueda de líneas', () => {
	it('lineMatchesFilter', () => {
		expect(lineMatchesFilter(line({ countedStock: null }), 'PENDING')).toBe(true);
		expect(lineMatchesFilter(line({ systemStock: 0, countedStock: null }), 'ZERO_STOCK')).toBe(
			true
		);
		expect(lineMatchesFilter(line({ systemStock: 5, countedStock: 7 }), 'WITH_DIFF')).toBe(true);
		expect(lineMatchesFilter(line({ countedStock: 5, recountedStock: null }), 'ALL')).toBe(true);
	});

	it('lineMatchesSearch', () => {
		expect(lineMatchesSearch({ itemName: 'Montura X', itemCode: 'SKU-1' }, 'montura')).toBe(true);
		expect(lineMatchesSearch({ itemName: 'Montura X', itemCode: 'SKU-1' }, 'sku-1')).toBe(true);
		expect(lineMatchesSearch({ itemName: 'Montura X', itemCode: 'SKU-1' }, 'nope')).toBe(false);
		expect(lineMatchesSearch({ itemName: 'Montura X', itemCode: null }, '')).toBe(true);
	});
});

describe('lineNeedsCost', () => {
	const base = {
		id: 7,
		itemType: 'PRODUCT',
		systemStock: 5,
		recountedStock: null,
		adjustmentMovementId: null
	};

	it('diferencia nueva sin costo → true', () => {
		expect(lineNeedsCost({ ...base, countedStock: 8 }, {})).toBe(true);
	});

	it('diferencia con costo ya cargado → false', () => {
		expect(lineNeedsCost({ ...base, countedStock: 8 }, { '7': 12.5 })).toBe(false);
	});

	it('sin diferencia (contado == sistema) → false', () => {
		expect(lineNeedsCost({ ...base, countedStock: 5 }, {})).toBe(false);
	});

	it('sin contar → false', () => {
		expect(lineNeedsCost({ ...base, countedStock: null }, {})).toBe(false);
	});

	it('el recuento manda para la diferencia', () => {
		expect(lineNeedsCost({ ...base, countedStock: 5, recountedStock: 9 }, {})).toBe(true);
		expect(lineNeedsCost({ ...base, countedStock: 9, recountedStock: 5 }, { '7': 3 })).toBe(false);
	});
});
