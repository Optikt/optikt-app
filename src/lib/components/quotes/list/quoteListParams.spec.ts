import { describe, expect, it } from 'vitest';
import {
	LIST_QUOTE_STATUSES,
	parseQuoteListPerPage,
	DEFAULT_QUOTE_LIST_SORT,
	parseQuoteListSort,
	parseQuoteStatuses,
	quoteListSortToOrder,
	serializeQuoteStatuses
} from './quoteListParams';
import { QuoteStatus } from '$lib/shared/contracts/quotes';

describe('parseQuoteListSort', () => {
	it('devuelve el default para valores ausentes o inválidos', () => {
		expect(parseQuoteListSort(null)).toBe(DEFAULT_QUOTE_LIST_SORT);
		expect(parseQuoteListSort('bogus')).toBe(DEFAULT_QUOTE_LIST_SORT);
	});

	it('acepta los tres órdenes del listado', () => {
		expect(parseQuoteListSort('recent')).toBe('recent');
		expect(parseQuoteListSort('total')).toBe('total');
		expect(parseQuoteListSort('expiring')).toBe('expiring');
	});
});

describe('quoteListSortToOrder', () => {
	it('"vencen primero" ordena por validUntil ascendente', () => {
		expect(quoteListSortToOrder('expiring')).toEqual({
			orderBy: 'validUntil',
			orderSort: 'asc'
		});
	});

	it('total → desc, recent → quoteDate desc', () => {
		expect(quoteListSortToOrder('total')).toEqual({ orderBy: 'total', orderSort: 'desc' });
		expect(quoteListSortToOrder('recent')).toEqual({ orderBy: 'quoteDate', orderSort: 'desc' });
	});
});

describe('parseQuoteStatuses / serializeQuoteStatuses', () => {
	it('parsea una lista separada por comas e ignora estados inválidos', () => {
		expect(parseQuoteStatuses('DRAFT,CONVERTED')).toEqual([
			QuoteStatus.DRAFT,
			QuoteStatus.CONVERTED
		]);
		expect(parseQuoteStatuses(' DRAFT , BOGUS ')).toEqual([QuoteStatus.DRAFT]);
		expect(parseQuoteStatuses(null)).toEqual([]);
	});

	it('serializa y el array vacío limpia el parámetro', () => {
		expect(serializeQuoteStatuses([QuoteStatus.DRAFT, QuoteStatus.CANCELLED])).toBe(
			'DRAFT,CANCELLED'
		);
		expect(serializeQuoteStatuses([])).toBeNull();
	});

	it('ida y vuelta respeta el orden de las pestañas', () => {
		const statuses = [QuoteStatus.DRAFT, QuoteStatus.CONVERTED, QuoteStatus.CANCELLED];
		expect(parseQuoteStatuses(serializeQuoteStatuses(statuses))).toEqual(statuses);
	});
});

describe('parseQuoteListPerPage', () => {
	it('acepta 10/25/50 y cae al default con valores inválidos', () => {
		expect(parseQuoteListPerPage('25')).toBe(25);
		expect(parseQuoteListPerPage('50')).toBe(50);
		expect(parseQuoteListPerPage('7')).toBe(10);
		expect(parseQuoteListPerPage(null)).toBe(10);
		expect(parseQuoteListPerPage('abc')).toBe(10);
	});
});

describe('LIST_QUOTE_STATUSES', () => {
	it('no incluye EXPIRED (la validez se calcula al leer)', () => {
		expect(LIST_QUOTE_STATUSES).not.toContain(QuoteStatus.EXPIRED);
		expect(LIST_QUOTE_STATUSES).toContain(QuoteStatus.DRAFT);
	});
});
