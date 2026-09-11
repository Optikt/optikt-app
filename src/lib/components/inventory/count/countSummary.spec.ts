import { describe, expect, it } from 'vitest';
import type {
	InventoryCountLineRow,
	InventoryCountSessionDetail
} from '$lib/server/db/queries/inventoryCount';
import {
	buildSummaryMessage,
	buildSummaryMetrics,
	compactStatClass,
	computeCountStats,
	filterCountLines,
	lifecycleSummaryFor,
	openedSummaryFor,
	scopeLabelFor,
	statusVariant
} from './countSummary';

function line(overrides: Partial<InventoryCountLineRow> = {}): InventoryCountLineRow {
	return {
		id: 1,
		countedStock: null,
		difference: null,
		adjustmentCompleted: false,
		itemType: 'PRODUCT',
		productId: 'prod-1',
		lensCatalogItemId: null,
		itemName: 'Montura X',
		itemCode: 'SKU-1',
		itemDetail: null,
		systemStock: 5,
		...overrides
	} as InventoryCountLineRow;
}

function session(overrides: Partial<InventoryCountSessionDetail> = {}): InventoryCountSessionDetail {
	return {
		status: 'OPEN',
		scopeType: 'ALL',
		scopeValue: null,
		notes: null,
		cancelReason: null,
		openedAt: '2026-09-01T10:00:00.000Z',
		openedByName: 'Ana',
		appliedAt: null,
		appliedByName: null,
		cancelledByName: null,
		...overrides
	} as InventoryCountSessionDetail;
}

const sampleLines = [
	line({ id: 1, countedStock: 5, difference: 0 }),
	line({ id: 2, countedStock: 8, difference: 3, adjustmentCompleted: true }),
	line({ id: 3, countedStock: 2, difference: -2 }),
	line({ id: 4, countedStock: null, difference: null, itemName: 'Cristal Y', itemCode: 'L-2' })
];

describe('computeCountStats', () => {
	it('aggregates coverage, diffs, units and progress', () => {
		const stats = computeCountStats(sampleLines);

		expect(stats.total).toBe(4);
		expect(stats.counted).toBe(3);
		expect(stats.pending).toBe(1);
		expect(stats.diffCount).toBe(2);
		expect(stats.matchedCount).toBe(1);
		expect(stats.completedAdjustments).toBe(1);
		expect(stats.pendingAdjustments).toBe(1);
		expect(stats.positiveUnits).toBe(3);
		expect(stats.negativeUnits).toBe(2);
		expect(stats.varianceUnits).toBe(1);
		expect(stats.varianceLabel).toBe('+1');
		expect(stats.progressPercent).toBe(75);
	});

	it('handles empty sessions', () => {
		const stats = computeCountStats([]);

		expect(stats.total).toBe(0);
		expect(stats.progressPercent).toBe(0);
		expect(stats.varianceLabel).toBe('Sin variación neta');
	});
});

describe('filterCountLines', () => {
	it('filters by status and search text', () => {
		expect(filterCountLines(sampleLines, 'ALL', '').length).toBe(4);
		expect(filterCountLines(sampleLines, 'PENDING', '').length).toBe(1);
		expect(filterCountLines(sampleLines, 'WITH_DIFF', '').length).toBe(2);
		expect(filterCountLines(sampleLines, 'OK', '').length).toBe(1);
		expect(filterCountLines(sampleLines, 'ALL', 'cristal').length).toBe(1);
		expect(filterCountLines(sampleLines, 'ALL', 'L-2').length).toBe(1);
		expect(filterCountLines(sampleLines, 'PENDING', 'montura').length).toBe(0);
	});
});

describe('buildSummaryMetrics', () => {
	it('builds four metrics with tones', () => {
		const metrics = buildSummaryMetrics(computeCountStats(sampleLines));

		expect(metrics.map((metric) => metric.id)).toEqual([
			'coverage',
			'differences',
			'variance',
			'adjustments'
		]);
		expect(metrics[0]).toMatchObject({ value: '3/4', tone: 'warning' });
		expect(metrics[2]).toMatchObject({ value: '+1', tone: 'success' });
		expect(metrics[3]).toMatchObject({ value: '1/2', tone: 'warning' });
	});
});

describe('buildSummaryMessage', () => {
	it('guides open sessions by pending count', () => {
		const incomplete = buildSummaryMessage({
			status: 'OPEN',
			notes: null,
			cancelReason: null,
			canClose: false,
			pendingTotal: 2,
			diffCount: 0,
			pendingAdjustments: 0
		});

		expect(incomplete).toEqual({
			label: 'Siguiente paso',
			message: 'Faltan 2 líneas por contar para poder cerrar la sesión.'
		});

		const ready = buildSummaryMessage({
			status: 'OPEN',
			notes: null,
			cancelReason: null,
			canClose: true,
			pendingTotal: 0,
			diffCount: 0,
			pendingAdjustments: 0
		});

		expect(ready.message).toBe('Conteo completo. La sesión está lista para cerrarse.');
	});

	it('reports cancel reason or fallback', () => {
		const withReason = buildSummaryMessage({
			status: 'CANCELLED',
			notes: null,
			cancelReason: 'Duplicada',
			canClose: false,
			pendingTotal: 0,
			diffCount: 0,
			pendingAdjustments: 0
		});

		expect(withReason).toEqual({ label: 'Motivo', message: 'Duplicada' });

		const withoutReason = buildSummaryMessage({
			status: 'CANCELLED',
			notes: null,
			cancelReason: null,
			canClose: false,
			pendingTotal: 0,
			diffCount: 0,
			pendingAdjustments: 0
		});

		expect(withoutReason.message).toBe('Sesión cancelada sin motivo registrado.');
	});

	it('summarizes closed sessions', () => {
		const clean = buildSummaryMessage({
			status: 'APPLIED',
			notes: null,
			cancelReason: null,
			canClose: false,
			pendingTotal: 0,
			diffCount: 0,
			pendingAdjustments: 0
		});

		expect(clean.message).toBe('La sesión quedó registrada sin diferencias pendientes.');

		const pending = buildSummaryMessage({
			status: 'APPLIED',
			notes: null,
			cancelReason: null,
			canClose: false,
			pendingTotal: 0,
			diffCount: 2,
			pendingAdjustments: 1
		});

		expect(pending.message).toBe('1 línea requiere ajuste manual.');
	});
});

describe('session labels', () => {
	it('describes scope, lifecycle and status', () => {
		expect(scopeLabelFor(session())).toBe('Todo el inventario');
		expect(
			scopeLabelFor(session({ scopeType: 'PRODUCT_CATEGORY', scopeValue: 'Monturas' }))
		).toBe('Solo productos - Monturas');
		expect(scopeLabelFor(session({ scopeType: 'LENS' }))).toBe('Solo lentes STOCK');
		expect(openedSummaryFor(session())).toContain('Ana');
		expect(lifecycleSummaryFor(session())).toBeNull();
		expect(
			lifecycleSummaryFor(
				session({ status: 'CANCELLED', cancelledByName: 'Luis', cancelReason: 'Error' })
			)
		).toContain('Luis · Error');
		expect(statusVariant('OPEN')).toBe('warning');
		expect(statusVariant('APPLIED')).toBe('success');
		expect(statusVariant('CANCELLED')).toBe('neutral');
		expect(compactStatClass('error')).toBe('text-error');
	});
});
