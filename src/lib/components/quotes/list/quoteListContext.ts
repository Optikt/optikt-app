/**
 * Contexto del listado de presupuestos (mismo patrón que `saleListContext`):
 * el `+page.svelte` guarda estado y handlers UNA vez y publica el mismo
 * contrato para la plantilla de escritorio y la móvil.
 */
import type { PaginatedQuotes } from '$lib/remote/quotes/queries.remote';
import type { QuoteStats, QuoteWithRelations } from '$lib/server/db/queries/quotes/types';
import type { QuoteStatus } from '$lib/shared/contracts/quotes';
import type { SaleFilterChip } from '$lib/components/sales/saleListContext';
import type { SaleDatePreset, SaleListView } from '$lib/components/sales/listParams';
import type { QuoteListSort } from './quoteListParams';

export const QUOTE_LIST_KEY = Symbol('quote-list');

export type QuoteListKpi = 'open' | 'month' | 'converted';

/** Switches «Mostrar solo» del listado de presupuestos (key compartida con ventas). */
export const QUOTE_LIST_TOGGLES: { key: 'cashea'; label: string }[] = [
	{ key: 'cashea', label: 'Cashea' }
];

export const QUOTE_LIST_SORT_OPTIONS: { value: QuoteListSort; label: string }[] = [
	{ value: 'recent', label: 'Más recientes' },
	{ value: 'total', label: 'Mayor total' },
	{ value: 'expiring', label: 'Vencen primero' }
];

export interface QuoteListHandlers {
	onSearch(value: string): void;
	onStatusesChange(next: QuoteStatus[]): void;
	onSellerChange(next: string): void;
	onPresetChange(next: SaleDatePreset): void;
	onRangeChange(from: string | null, to: string | null): void;
	onToggleCashea(): void;
	onSortChange(next: QuoteListSort): void;
	onPerPageChange(next: number): void;
	onKpiSelect(kpi: QuoteListKpi): void;
	onViewChange(next: SaleListView): void;
	onClearFilters(): void;
	onCreate(): void;
	onOpen(quote: QuoteWithRelations): void;
	onEdit(quote: QuoteWithRelations): void;
	onDuplicate(quote: QuoteWithRelations): void;
	onConvert(quote: QuoteWithRelations): void;
	onCancelRequest(quote: QuoteWithRelations): void;
	onPageChange(next: number, opts?: { scrollTop?: boolean }): void;
	openMobileFilters(): void;
	closeMobileFilters(): void;
	openMobileActions(quote: QuoteWithRelations): void;
	closeMobileActions(): void;
}

export interface QuoteMobileUi {
	filtersOpen: boolean;
	actionsOpen: boolean;
	actionsQuote: QuoteWithRelations | null;
}

export interface QuoteListContext {
	readonly quotesData: PaginatedQuotes;
	/** Conteos por estado (pestañas). */
	readonly facets: Record<string, number>;
	readonly stats: QuoteStats;
	readonly sellers: { id: string; fullName: string }[];
	readonly loading: boolean;
	readonly view: SaleListView;
	readonly search: string;
	readonly statuses: QuoteStatus[];
	readonly sellerId: string;
	readonly preset: SaleDatePreset;
	readonly from: string | null;
	readonly to: string | null;
	readonly sort: QuoteListSort;
	readonly cashea: boolean;
	readonly canAct: boolean;
	readonly chips: SaleFilterChip[];
	readonly mobileUi: QuoteMobileUi;
	readonly handlers: QuoteListHandlers;
}
