/**
 * Parámetros de URL del listado de ventas — parseo tolerante (valores inválidos se ignoran).
 *
 * Contrato (plan `sales-list-redesign`, §4.1): todos los params nuevos son ADITIVOS.
 * Los heredados (`q`, `status`, `shippingPending`, `freeItem`, `cashea`, `page`)
 * siguen intactos y se parsean con `parsePageParam` / `parseBooleanParam` de `$lib/utils`
 * y `parseSaleStatuses` de `./statusFilter`.
 *
 * Precedencia de vista: `?view=` (URL) > preferencia del perfil > `list`.
 */
import { toISODate } from '$lib/dates';

export type SaleListView = 'list' | 'grid';
export type SaleListSort = 'recent' | 'balance' | 'total' | 'old';
export type SaleListAction = 'pay' | 'status';
export type SaleDatePreset = 'all' | 'today' | '7d' | 'month' | 'custom';

export const SALE_LIST_VIEWS: readonly SaleListView[] = ['list', 'grid'];
export const SALE_LIST_SORTS: readonly SaleListSort[] = ['recent', 'balance', 'total', 'old'];
export const SALE_LIST_ACTIONS: readonly SaleListAction[] = ['pay', 'status'];
export const SALE_LIST_PAGE_SIZES = [10, 25, 50] as const;
export const SALE_DATE_PRESETS: readonly SaleDatePreset[] = [
	'all',
	'today',
	'7d',
	'month',
	'custom'
];

/** Etiquetas de los presets de fecha — única fuente (page, FilterBar, hoja móvil). */
export const SALE_DATE_PRESET_LABELS: Record<SaleDatePreset, string> = {
	all: 'Todas las fechas',
	today: 'Hoy',
	'7d': 'Últimos 7 días',
	month: 'Este mes',
	custom: 'Personalizado'
};

/** Opciones de orden — única fuente (FilterBar escritorio + hoja móvil). */
export const SALE_LIST_SORT_OPTIONS: { value: SaleListSort; label: string }[] = [
	{ value: 'recent', label: 'Más recientes' },
	{ value: 'balance', label: 'Mayor saldo' },
	{ value: 'total', label: 'Mayor total' },
	{ value: 'old', label: 'Más antiguas' }
];

/** Toggles del listado (etiquetas únicas: el chip y el switch muestran lo mismo). */
export type SaleListToggleKey = 'cashea' | 'shippingPending' | 'freeItem' | 'balance';
export const SALE_LIST_TOGGLES: { key: SaleListToggleKey; label: string }[] = [
	{ key: 'cashea', label: 'Cashea' },
	{ key: 'shippingPending', label: 'Envío pendiente' },
	{ key: 'freeItem', label: 'Ítem libre' },
	{ key: 'balance', label: 'Con saldo pendiente' }
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_SALE_LIST_VIEW: SaleListView = 'list';
/**
 * Llave de `user_preferences` de la vista Lista/Cuadros. UNA sola para ventas
 * y presupuestos: cambiar la vista en un listado la cambia en el otro.
 */
export const LIST_VIEW_PREFERENCE_KEY = 'sales.view';
export const DEFAULT_SALE_LIST_SORT: SaleListSort = 'recent';
export const DEFAULT_SALE_LIST_PER_PAGE = 10;

/** `?view=` → 'list' | 'grid' | null (inválido → null). */
export function parseSaleListView(value: string | null): SaleListView | null {
	return value && (SALE_LIST_VIEWS as readonly string[]).includes(value)
		? (value as SaleListView)
		: null;
}

/** `?sort=` → orden efectivo (inválido o ausente → default). */
export function parseSaleListSort(value: string | null): SaleListSort {
	const parsed =
		value && (SALE_LIST_SORTS as readonly string[]).includes(value)
			? (value as SaleListSort)
			: null;
	return parsed ?? DEFAULT_SALE_LIST_SORT;
}

/** `?per=` → tamaño de página; solo 10 | 25 | 50 (inválido → default). */
export function parseSaleListPerPage(value: string | null): number {
	const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
	return (SALE_LIST_PAGE_SIZES as readonly number[]).includes(parsed)
		? parsed
		: DEFAULT_SALE_LIST_PER_PAGE;
}

/** `?action=` → intención de acción para el detalle (inválido → null, se ignora). */
export function parseSaleAction(value: string | null): SaleListAction | null {
	return value && (SALE_LIST_ACTIONS as readonly string[]).includes(value)
		? (value as SaleListAction)
		: null;
}

/** Fecha date-only válida (`YYYY-MM-DD`) o null. */
export function parseIsoDateOnly(value: string | null): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!ISO_DATE_RE.test(trimmed)) return null;
	const date = new Date(`${trimmed}T00:00:00`);
	return Number.isNaN(date.getTime()) ? null : trimmed;
}

function startOfLocalDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Rango (date-only) que produce cada preset, calculado contra `now`.
 * `all` y `custom` no generan rango (`custom` lo define el datepicker del usuario).
 */
export function saleListPresetRange(
	preset: SaleDatePreset,
	now: Date
): { from: string | null; to: string | null } {
	const today = startOfLocalDay(now);
	switch (preset) {
		case 'today':
			return { from: toISODate(today), to: toISODate(today) };
		case '7d':
			return { from: toISODate(addDays(today, -6)), to: toISODate(today) };
		case 'month':
			return {
				from: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)),
				to: toISODate(today)
			};
		default:
			return { from: null, to: null };
	}
}

/**
 * Preset activo a partir de `from`/`to` en la URL (para resaltar el chip/select).
 * Sin fechas → 'all'; rango que no coincide con ningún preset → 'custom'.
 */
export function saleListDatePreset(
	from: string | null,
	to: string | null,
	now: Date
): SaleDatePreset {
	if (!from && !to) return 'all';
	for (const preset of ['today', '7d', 'month'] as const) {
		const range = saleListPresetRange(preset, now);
		if (range.from === from && range.to === to) return preset;
	}
	return 'custom';
}

/** Columna/dirección de orden equivalente a cada `sort` del listado. */
export type SaleListOrderBy = 'orderNumber' | 'total' | 'balance';
export type SaleListOrderSort = 'asc' | 'desc';

export function saleListSortToOrder(sort: SaleListSort): {
	orderBy?: SaleListOrderBy;
	orderSort: SaleListOrderSort;
} {
	switch (sort) {
		case 'balance':
			return { orderBy: 'balance', orderSort: 'desc' };
		case 'total':
			return { orderBy: 'total', orderSort: 'desc' };
		case 'old':
			return { orderBy: 'orderNumber', orderSort: 'asc' };
		default:
			return { orderSort: 'desc' };
	}
}
