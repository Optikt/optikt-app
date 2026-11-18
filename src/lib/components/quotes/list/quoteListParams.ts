/**
 * Parámetros de URL del listado de presupuestos — reutiliza el parseo de
 * ventas (`listParams.ts` de sales): fechas, presets y tamaños de página.
 * El `sort` de quotes es propio: recent | total | expiring.
 */
import {
	parseIsoDateOnly,
	saleListDatePreset,
	saleListPresetRange,
	SALE_LIST_PAGE_SIZES,
	DEFAULT_SALE_LIST_PER_PAGE,
	type SaleDatePreset
} from '$lib/components/sales/listParams';
import { ALL_QUOTE_STATUSES, type QuoteStatus } from '$lib/shared/contracts/quotes';

/** `?status=DRAFT,CONVERTIDO` → estados válidos (inválidos se ignoran). */
export function parseQuoteStatuses(value: string | null): QuoteStatus[] {
	if (!value) return [];
	return value
		.split(',')
		.map((v) => v.trim())
		.filter((v): v is QuoteStatus => ALL_QUOTE_STATUSES.includes(v as QuoteStatus));
}

/** Estados → `?status=` (array vacío limpia el parámetro). */
export function serializeQuoteStatuses(statuses: QuoteStatus[]): string | null {
	return statuses.length > 0 ? statuses.join(',') : null;
}

export type QuoteListSort = 'recent' | 'total' | 'expiring';

export const QUOTE_LIST_SORTS: readonly QuoteListSort[] = ['recent', 'total', 'expiring'];
export const DEFAULT_QUOTE_LIST_SORT: QuoteListSort = 'recent';

export const QUOTE_LIST_PAGE_SIZES = SALE_LIST_PAGE_SIZES;
export const DEFAULT_QUOTE_LIST_PER_PAGE = DEFAULT_SALE_LIST_PER_PAGE;

/** `?sort=` → orden efectivo (inválido o ausente → default). */
export function parseQuoteListSort(value: string | null): QuoteListSort {
	return value && (QUOTE_LIST_SORTS as readonly string[]).includes(value)
		? (value as QuoteListSort)
		: DEFAULT_QUOTE_LIST_SORT;
}

export { parseIsoDateOnly, saleListDatePreset, saleListPresetRange };
export type { SaleDatePreset };

/** Columna/dirección de orden equivalente a cada `sort` del listado de quotes. */
export function quoteListSortToOrder(sort: QuoteListSort): {
	orderBy: 'quoteDate' | 'total' | 'validUntil';
	orderSort: 'asc' | 'desc';
} {
	switch (sort) {
		case 'total':
			return { orderBy: 'total', orderSort: 'desc' };
		case 'expiring':
			return { orderBy: 'validUntil', orderSort: 'asc' };
		default:
			return { orderBy: 'quoteDate', orderSort: 'desc' };
	}
}
