<script lang="ts">
	import { setContext } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { getAppMainScroll } from '$lib/utils/scroll';
	import {
		getErrorMessage,
		logger,
		parseBooleanParam,
		parsePageParam,
		replaceUrlSearch,
		saveReferrerParams,
		setQueryParam
	} from '$lib/utils';
	import { listSales, getSalesStats } from '$lib/remote/sales/queries.remote';
	import { persistListView } from '$lib/components/sales/listViewPreference';
	import CancelSaleModal from '$lib/components/sales/CancelSaleModal.svelte';
	import SaleListDesktop from '$lib/components/sales/SaleListDesktop.svelte';
	import SaleListMobile from '$lib/components/sales/SaleListMobile.svelte';
	import SaleMobileOverlays from '$lib/components/sales/SaleMobileOverlays.svelte';
	import SaleListSkeleton from '$lib/components/sales/SaleListSkeleton.svelte';
	import Fab from '$lib/components/ui/Fab.svelte';
	import { parseSaleStatuses, serializeSaleStatuses } from '$lib/components/sales/statusFilter';
	import {
		DEFAULT_SALE_LIST_PER_PAGE,
		DEFAULT_SALE_LIST_SORT,
		DEFAULT_SALE_LIST_VIEW,
		SALE_DATE_PRESET_LABELS,
		parseIsoDateOnly,
		parseSaleListPerPage,
		parseSaleListSort,
		parseSaleListView,
		saleListDatePreset,
		saleListPresetRange,
		type SaleDatePreset,
		type SaleListSort,
		type SaleListView
	} from '$lib/components/sales/listParams';
	import {
		SALE_LIST_KEY,
		type SaleFilterChip,
		type SaleListContext,
		type SaleMobileUi
	} from '$lib/components/sales/saleListContext';
	import { canOperate, SaleStatus, SALE_STATUS_LABELS } from '$lib/shared/enums';
	import type { SaleListItem, SalesStats } from '$lib/server/db/queries/sales/types';
	import type { PaginatedSales } from '$lib/remote/sales/helpers';

	// ── Datos iniciales (SSR) ────────────────────────────────────────────────
	let { data } = $props();
	const {
		sales: initialSales,
		total: initialTotal,
		facets: initialFacets,
		selection: initialSelection,
		page: initialPageNumber,
		perPage: initialPerPage,
		totalPages: initialTotalPages,
		stats: initialStats,
		sellers: initialSellers,
		preferredView: initialPreferredView
	} = untrack(() => data);
	const initialQuery = untrack(() => page.url.searchParams);

	const initialPage = parsePageParam(initialQuery.get('page'));
	const initialSearch = initialQuery.get('q') ?? '';
	const initialStatuses = parseSaleStatuses(initialQuery.get('status'));
	const initialSeller = initialQuery.get('seller') ?? '';
	const initialFrom = parseIsoDateOnly(initialQuery.get('from'));
	const initialTo = parseIsoDateOnly(initialQuery.get('to'));
	const initialSort = parseSaleListSort(initialQuery.get('sort'));
	const initialPer = parseSaleListPerPage(initialQuery.get('per'));
	const urlView = parseSaleListView(initialQuery.get('view'));

	// ── Estado ───────────────────────────────────────────────────────────────
	let salesData = $state<PaginatedSales>({
		sales: initialSales,
		total: initialTotal,
		page: initialPageNumber,
		perPage: initialPerPage,
		totalPages: initialTotalPages,
		facets: initialFacets,
		selection: initialSelection
	});
	let stats = $state<SalesStats>(initialStats);
	let sellers = $state(initialSellers);
	let loading = $state(false);

	// Filtros (URL = fuente de verdad)
	let view = $state<SaleListView>(urlView ?? initialPreferredView ?? DEFAULT_SALE_LIST_VIEW);
	let search = $state(initialSearch);
	let statuses = $state<SaleStatus[]>(initialStatuses);
	let sellerId = $state(initialSeller);
	let preset = $state<SaleDatePreset>(saleListDatePreset(initialFrom, initialTo, new Date()));
	let from = $state(initialFrom);
	let to = $state(initialTo);
	let sort = $state<SaleListSort>(initialSort);
	let per = $state(initialPer);
	let currentPage = $state(initialPage);
	let shippingPending = $state(parseBooleanParam(initialQuery.get('shippingPending')));
	let freeItem = $state(parseBooleanParam(initialQuery.get('freeItem')));
	let cashea = $state(parseBooleanParam(initialQuery.get('cashea')));
	let balance = $state(parseBooleanParam(initialQuery.get('balance')));

	const canAct = $derived(canOperate(data.user.role));

	// ── URL ──────────────────────────────────────────────────────────────────
	function syncUrl(nextPage: number): void {
		replaceUrlSearch(page.url, (params) => {
			setQueryParam(params, 'q', search.trim());
			setQueryParam(params, 'status', serializeSaleStatuses(statuses));
			setQueryParam(params, 'shippingPending', shippingPending ? '1' : null);
			setQueryParam(params, 'freeItem', freeItem ? '1' : null);
			setQueryParam(params, 'cashea', cashea ? '1' : null);
			setQueryParam(params, 'balance', balance ? '1' : null);
			setQueryParam(params, 'seller', sellerId);
			setQueryParam(params, 'from', from);
			setQueryParam(params, 'to', to);
			setQueryParam(params, 'sort', sort === DEFAULT_SALE_LIST_SORT ? null : sort);
			setQueryParam(params, 'per', per === DEFAULT_SALE_LIST_PER_PAGE ? null : per);
			setQueryParam(params, 'view', view === DEFAULT_SALE_LIST_VIEW ? null : view);
			setQueryParam(params, 'page', nextPage > 1 ? nextPage : null);
		});
	}

	// ── Fetch ────────────────────────────────────────────────────────────────
	async function fetchSales(nextPage: number, opts?: { scrollTop?: boolean }): Promise<void> {
		currentPage = nextPage;
		syncUrl(nextPage);
		loading = true;
		try {
			salesData = await listSales({
				page: nextPage,
				perPage: per,
				search: search.trim() || undefined,
				statuses: statuses.length > 0 ? statuses : undefined,
				shippingCostPending: shippingPending || undefined,
				hasFreeItem: freeItem || undefined,
				isCashea: cashea || undefined,
				balance: balance || undefined,
				sellerId: sellerId || undefined,
				dateFrom: from ?? undefined,
				dateTo: to ?? undefined,
				sort
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando ventas'));
		} finally {
			loading = false;
			// Móvil: al cambiar de página, volver al inicio de la lista (mockup §3.8).
			if (opts?.scrollTop) getAppMainScroll()?.scrollTo({ top: 0 });
		}
	}

	async function refreshStats(): Promise<void> {
		try {
			stats = await getSalesStats({});
		} catch (e) {
			logger.error('Error cargando estadísticas de ventas', e);
		}
	}

	// ── Handlers de filtro ───────────────────────────────────────────────────
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleSearch(value: string): void {
		search = value;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => void fetchSales(1), 300);
	}

	function handleStatusesChange(next: SaleStatus[]): void {
		statuses = next;
		void fetchSales(1);
	}

	function handleSellerChange(next: string): void {
		sellerId = next;
		void fetchSales(1);
	}

	function handlePresetChange(next: SaleDatePreset): void {
		preset = next;
		const range = saleListPresetRange(next, new Date());
		from = range.from;
		to = range.to;
		void fetchSales(1);
	}

	function handleRangeChange(nextFrom: string | null, nextTo: string | null): void {
		from = nextFrom;
		to = nextTo;
		preset = saleListDatePreset(nextFrom, nextTo, new Date());
		void fetchSales(1);
	}

	function handleToggle(key: 'shippingPending' | 'freeItem' | 'cashea' | 'balance'): void {
		if (key === 'shippingPending') shippingPending = !shippingPending;
		else if (key === 'freeItem') freeItem = !freeItem;
		else if (key === 'cashea') cashea = !cashea;
		else balance = !balance;
		void fetchSales(1);
	}

	function handleSortChange(next: SaleListSort): void {
		sort = next;
		void fetchSales(1);
	}

	function handlePerPageChange(next: number): void {
		per = next;
		void fetchSales(1);
	}

	// ── Cancelación (modal en el listado, como hasta ahora) ──────────────────
	let cancelTarget = $state<SaleListItem | null>(null);
	let cancelOpen = $state(false);

	// UI móvil (hojas): estado dueño de la página; los hijos lo tocan solo vía handlers.
	let mobileUi = $state<SaleMobileUi>({
		filtersOpen: false,
		actionsOpen: false,
		actionsSale: null
	});

	function handleCancelRequest(sale: SaleListItem): void {
		cancelTarget = sale;
		cancelOpen = true;
	}

	function clearFilters(): void {
		search = '';
		statuses = [];
		shippingPending = false;
		freeItem = false;
		cashea = false;
		balance = false;
		sellerId = '';
		preset = 'all';
		from = null;
		to = null;
		void fetchSales(1);
	}

	// ── Chips (una sola fuente de verdad de "filtros activos") ───────────────
	const PRESET_LABELS: Record<SaleDatePreset, string> = {
		...SALE_DATE_PRESET_LABELS,
		// El chip dice qué filtra: «Rango de fechas» en vez de «Personalizado».
		custom: 'Rango de fechas'
	};

	const chips = $derived.by(() => {
		const list: SaleFilterChip[] = [];
		for (const status of statuses) {
			list.push({
				id: `status:${status}`,
				label: SALE_STATUS_LABELS[status],
				onRemove: () => handleStatusesChange(statuses.filter((s) => s !== status))
			});
		}
		if (cashea) {
			list.push({ id: 'cashea', label: 'Cashea', onRemove: () => handleToggle('cashea') });
		}
		if (shippingPending) {
			list.push({
				id: 'shippingPending',
				label: 'Envío pendiente',
				onRemove: () => handleToggle('shippingPending')
			});
		}
		if (freeItem) {
			list.push({ id: 'freeItem', label: 'Ítem libre', onRemove: () => handleToggle('freeItem') });
		}
		if (balance) {
			list.push({ id: 'balance', label: 'Con saldo', onRemove: () => handleToggle('balance') });
		}
		if (sellerId) {
			list.push({
				id: 'seller',
				label: `Vendedor: ${sellers.find((s) => s.id === sellerId)?.fullName ?? ''}`,
				onRemove: () => handleSellerChange('')
			});
		}
		if (preset !== 'all') {
			list.push({
				id: 'range',
				label: PRESET_LABELS[preset] ?? 'Rango de fechas',
				onRemove: () => handlePresetChange('all')
			});
		}
		return list;
	});

	const activeToggleCount = $derived(
		(cashea ? 1 : 0) + (shippingPending ? 1 : 0) + (freeItem ? 1 : 0) + (balance ? 1 : 0)
	);

	// ── KPIs ─────────────────────────────────────────────────────────────────
	function handleKpiSelect(kpi: 'receivable' | 'month' | 'ready'): void {
		if (kpi === 'receivable') {
			balance = true;
			statuses = [];
			sort = 'balance';
		} else if (kpi === 'month') {
			const range = saleListPresetRange('month', new Date());
			preset = 'month';
			from = range.from;
			to = range.to;
		} else {
			statuses = [SaleStatus.READY];
		}
		void fetchSales(1);
	}

	// ── Vista (preferencia por perfil) ───────────────────────────────────────
	function handleViewChange(next: SaleListView): void {
		if (next === view) return;
		view = next;
		syncUrl(currentPage);
		void persistListView(next);
	}

	// ── Navegación ───────────────────────────────────────────────────────────
	function handleView(sale: SaleListItem): void {
		void goto(resolve(`/sales/${sale.id}`));
	}

	beforeNavigate(({ to: next }) => {
		const path = next?.url.pathname ?? '';
		if (path !== '/sales' && path.startsWith('/sales')) {
			saveReferrerParams('/sales');
		}
	});

	// ── Contexto compartido (escritorio y móvil consumen el mismo estado) ────
	const ctx: SaleListContext = {
		get salesData() {
			return salesData;
		},
		get stats() {
			return stats;
		},
		get sellers() {
			return sellers;
		},
		get loading() {
			return loading;
		},
		get view() {
			return view;
		},
		get search() {
			return search;
		},
		get statuses() {
			return statuses;
		},
		get sellerId() {
			return sellerId;
		},
		get preset() {
			return preset;
		},
		get from() {
			return from;
		},
		get to() {
			return to;
		},
		get sort() {
			return sort;
		},
		get per() {
			return per;
		},
		get currentPage() {
			return currentPage;
		},
		get cashea() {
			return cashea;
		},
		get shippingPending() {
			return shippingPending;
		},
		get freeItem() {
			return freeItem;
		},
		get balance() {
			return balance;
		},
		get canAct() {
			return canAct;
		},
		get user() {
			return data.user;
		},
		get chips() {
			return chips;
		},
		get activeToggleCount() {
			return activeToggleCount;
		},
		get mobileUi() {
			return mobileUi;
		},
		handlers: {
			onSearch: handleSearch,
			onStatusesChange: handleStatusesChange,
			onSellerChange: handleSellerChange,
			onPresetChange: handlePresetChange,
			onRangeChange: handleRangeChange,
			onToggle: handleToggle,
			onSortChange: handleSortChange,
			onPerPageChange: handlePerPageChange,
			onKpiSelect: handleKpiSelect,
			onViewChange: handleViewChange,
			onClearFilters: clearFilters,
			onOpenSale: handleView,
			onCancelRequest: handleCancelRequest,
			onPageChange: (next, opts) => void fetchSales(next, opts),
			openMobileFilters: () => {
				mobileUi.filtersOpen = true;
			},
			closeMobileFilters: () => {
				mobileUi.filtersOpen = false;
			},
			openMobileActions: (sale) => {
				mobileUi.actionsSale = sale;
				mobileUi.actionsOpen = true;
			},
			closeMobileActions: () => {
				mobileUi.actionsOpen = false;
				mobileUi.actionsSale = null;
			}
		}
	};
	setContext(SALE_LIST_KEY, ctx);

	// ── Detección de móvil (contenedor, igual que el detalle: <700 px) ───────
	// ResizeObserver sobre el WRAPPER sin padding variable (mismo patrón del
	// detalle): si midiera el div con padding, cambiar `isNarrow` cambiaría el
	// ancho medido y provocaría el loop de ResizeObserver. `null` = sin medir
	// aún: esqueleto neutro, sin flash de escritorio en teléfono.
	let pageEl = $state<HTMLElement | undefined>(undefined);
	let isNarrow = $state<boolean | null>(null);

	$effect(() => {
		const target = pageEl;
		if (!target) return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width === undefined) return;
			isNarrow = width < 700;
		});
		observer.observe(target);
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>Ventas - Optikt</title>
</svelte:head>

<div
	bind:this={pageEl}
	class="animate-rise @container mx-auto w-full max-w-[1280px] min-[1440px]:max-w-[1440px] min-[1920px]:max-w-[1600px] min-[2400px]:max-w-[1920px]"
>
	<!-- El padding va en el hijo: el observer mide un ancho estable (sin loop). -->
	<div class="flex flex-col gap-3 {isNarrow ? 'px-3 pt-3 pb-24' : 'px-5 pt-3.5 pb-7'}">
		{#if isNarrow === null}
			<SaleListSkeleton />
		{:else if isNarrow}
			<SaleListMobile />
		{:else}
			<SaleListDesktop />
		{/if}

		{#if cancelTarget}
			<CancelSaleModal
				bind:open={cancelOpen}
				saleId={cancelTarget.id}
				paidAmountBcvUsd={cancelTarget.paidAmountBcvUsd}
				onSuccess={() => {
					void fetchSales(currentPage);
					void refreshStats();
				}}
			/>
		{/if}
	</div>
</div>

<!-- Hojas móviles: FUERA del contenedor (@container + fixed son incompatibles). -->
{#if isNarrow}
	<SaleMobileOverlays />
{/if}

<!-- FAB fuera del contenedor (@container + fixed son incompatibles). -->
<Fab label="Nueva venta" href="/sales/new" hidden={isNarrow !== true || !canAct} />
