/**
 * Contexto del listado de ventas (patrón wizardContext): el `+page.svelte`
 * guarda el estado y los handlers UNA vez y publica el mismo contrato para la
 * plantilla de escritorio y la móvil — sin duplicar lógica de filtros/URL.
 */
import type { PaginatedSales } from '$lib/remote/sales/helpers';
import type { SaleListItem, SalesStats } from '$lib/server/db/queries/sales/types';
import type { UserRole } from '$lib/shared/enums';
import type { SaleStatus } from '$lib/shared/enums';
import type { SaleDatePreset, SaleListSort, SaleListView } from './listParams';

export const SALE_LIST_KEY = Symbol('sale-list');

export interface SaleFilterChip {
	id: string;
	label: string;
	onRemove: () => void;
}

export type SaleListToggleKey = 'cashea' | 'shippingPending' | 'freeItem' | 'balance';
export type SaleListKpi = 'receivable' | 'month' | 'ready';

export interface SaleListHandlers {
	onSearch(value: string): void;
	onStatusesChange(next: SaleStatus[]): void;
	onSellerChange(next: string): void;
	onPresetChange(next: SaleDatePreset): void;
	onRangeChange(from: string | null, to: string | null): void;
	onToggle(key: SaleListToggleKey): void;
	onSortChange(next: SaleListSort): void;
	onPerPageChange(next: number): void;
	onKpiSelect(kpi: SaleListKpi): void;
	onViewChange(next: SaleListView): void;
	onClearFilters(): void;
	/** CTA «Nueva venta» del header de escritorio (en móvil va al FAB). */
	onCreate(): void;
	onOpenSale(sale: SaleListItem): void;
	onCancelRequest(sale: SaleListItem): void;
	onPageChange(next: number, opts?: { scrollTop?: boolean }): void;
	/** UI móvil (hojas): apertura/cierre — la página es la dueña del estado. */
	openMobileFilters(): void;
	closeMobileFilters(): void;
	openMobileActions(sale: SaleListItem): void;
	closeMobileActions(): void;
}

export interface SaleMobileUi {
	/** Hoja de filtros móvil. */
	filtersOpen: boolean;
	/** Hoja de acciones del ⋯ (venta objetivo + abierta). */
	actionsOpen: boolean;
	actionsSale: SaleListItem | null;
}

export interface SaleListContext {
	/** Datos de la página actual (PaginatedSales). */
	readonly salesData: PaginatedSales;
	readonly stats: SalesStats;
	readonly sellers: { id: string; fullName: string }[];
	readonly loading: boolean;
	readonly view: SaleListView;
	readonly search: string;
	readonly statuses: SaleStatus[];
	readonly sellerId: string;
	readonly preset: SaleDatePreset;
	readonly from: string | null;
	readonly to: string | null;
	readonly sort: SaleListSort;
	readonly per: number;
	readonly currentPage: number;
	readonly cashea: boolean;
	readonly shippingPending: boolean;
	readonly freeItem: boolean;
	readonly balance: boolean;
	/** `canOperate(role)` — VIEWER = false. */
	readonly canAct: boolean;
	readonly user: { id: string; role: UserRole };
	/** Chips de filtros activos (estados + toggles + vendedor + rango). */
	readonly chips: SaleFilterChip[];
	readonly activeToggleCount: number;
	/** UI móvil compartida (hojas fuera del contenedor `@container`). */
	readonly mobileUi: SaleMobileUi;
	readonly handlers: SaleListHandlers;
}
