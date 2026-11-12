import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SALE_LIST_PER_PAGE,
	parseIsoDateOnly,
	parseSaleAction,
	parseSaleListPerPage,
	parseSaleListSort,
	parseSaleListView,
	saleListDatePreset,
	saleListPresetRange,
	saleListSortToOrder
} from './listParams';

describe('parseSaleListView', () => {
	it('acepta list y grid', () => {
		expect(parseSaleListView('list')).toBe('list');
		expect(parseSaleListView('grid')).toBe('grid');
	});

	it('ignora valores inválidos y ausentes', () => {
		expect(parseSaleListView('tablero')).toBeNull();
		expect(parseSaleListView('')).toBeNull();
		expect(parseSaleListView(null)).toBeNull();
	});
});

describe('parseSaleListSort', () => {
	it('acepta los órdenes válidos', () => {
		expect(parseSaleListSort('balance')).toBe('balance');
		expect(parseSaleListSort('old')).toBe('old');
	});

	it('cae al default con valores inválidos o ausentes', () => {
		expect(parseSaleListSort('precio')).toBe('recent');
		expect(parseSaleListSort(null)).toBe('recent');
	});
});

describe('parseSaleListPerPage', () => {
	it('solo admite 10, 25 y 50', () => {
		expect(parseSaleListPerPage('25')).toBe(25);
		expect(parseSaleListPerPage('50')).toBe(50);
	});

	it('cae al default con tamaños no soportados', () => {
		expect(parseSaleListPerPage('7')).toBe(DEFAULT_SALE_LIST_PER_PAGE);
		expect(parseSaleListPerPage('100')).toBe(DEFAULT_SALE_LIST_PER_PAGE);
		expect(parseSaleListPerPage('abc')).toBe(DEFAULT_SALE_LIST_PER_PAGE);
		expect(parseSaleListPerPage(null)).toBe(DEFAULT_SALE_LIST_PER_PAGE);
	});
});

describe('parseSaleAction', () => {
	it('solo admite pay y status', () => {
		expect(parseSaleAction('pay')).toBe('pay');
		expect(parseSaleAction('status')).toBe('status');
	});

	it('ignora cualquier otro valor', () => {
		expect(parseSaleAction('edit')).toBeNull();
		expect(parseSaleAction('')).toBeNull();
		expect(parseSaleAction(null)).toBeNull();
	});
});

describe('parseIsoDateOnly', () => {
	it('acepta fechas ISO date-only', () => {
		expect(parseIsoDateOnly('2026-11-09')).toBe('2026-11-09');
	});

	it('rechaza timestamps, basura y fechas malformadas', () => {
		expect(parseIsoDateOnly('2026-11-09T10:00:00Z')).toBeNull();
		expect(parseIsoDateOnly('09-11-2026')).toBeNull();
		expect(parseIsoDateOnly('2026-13-40')).toBeNull();
		expect(parseIsoDateOnly('ayer')).toBeNull();
		expect(parseIsoDateOnly(null)).toBeNull();
	});
});

describe('saleListPresetRange', () => {
	const now = new Date(2026, 10, 9, 15, 30); // 09/11/2026

	it('hoy devuelve el mismo día en from y to', () => {
		expect(saleListPresetRange('today', now)).toEqual({ from: '2026-11-09', to: '2026-11-09' });
	});

	it('7 días incluye hoy (6 días hacia atrás)', () => {
		expect(saleListPresetRange('7d', now)).toEqual({ from: '2026-11-03', to: '2026-11-09' });
	});

	it('este mes va del día 1 a hoy', () => {
		expect(saleListPresetRange('month', now)).toEqual({ from: '2026-11-01', to: '2026-11-09' });
	});

	it('all y custom no generan rango', () => {
		expect(saleListPresetRange('all', now)).toEqual({ from: null, to: null });
		expect(saleListPresetRange('custom', now)).toEqual({ from: null, to: null });
	});
});

describe('saleListDatePreset', () => {
	const now = new Date(2026, 10, 9, 15, 30);

	it('sin fechas es all', () => {
		expect(saleListDatePreset(null, null, now)).toBe('all');
	});

	it('reconoce los presets conocidos', () => {
		expect(saleListDatePreset('2026-11-09', '2026-11-09', now)).toBe('today');
		expect(saleListDatePreset('2026-11-03', '2026-11-09', now)).toBe('7d');
		expect(saleListDatePreset('2026-11-01', '2026-11-09', now)).toBe('month');
	});

	it('un rango libre es custom', () => {
		expect(saleListDatePreset('2026-10-01', '2026-10-15', now)).toBe('custom');
		expect(saleListDatePreset('2026-11-01', null, now)).toBe('custom');
	});

	it('es inverso de saleListPresetRange (round-trip)', () => {
		for (const preset of ['today', '7d', 'month'] as const) {
			const range = saleListPresetRange(preset, now);
			expect(saleListDatePreset(range.from, range.to, now)).toBe(preset);
		}
	});
});

describe('saleListSortToOrder', () => {
	it('recent no impone columna (el default sigue siendo orderNumber DESC)', () => {
		expect(saleListSortToOrder('recent')).toEqual({ orderSort: 'desc' });
	});

	it('balance y total ordenan descendente', () => {
		expect(saleListSortToOrder('balance')).toEqual({ orderBy: 'balance', orderSort: 'desc' });
		expect(saleListSortToOrder('total')).toEqual({ orderBy: 'total', orderSort: 'desc' });
	});

	it('old ordena por número de orden ascendente', () => {
		expect(saleListSortToOrder('old')).toEqual({ orderBy: 'orderNumber', orderSort: 'asc' });
	});
});
