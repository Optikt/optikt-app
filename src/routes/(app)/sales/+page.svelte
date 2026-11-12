<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
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
	import { saveUserPreference } from '$lib/remote/users/preferences.remote';
	import SaleListHeader from '$lib/components/sales/SaleListHeader.svelte';
	import SaleKpiCards from '$lib/components/sales/SaleKpiCards.svelte';
	import SaleFilterBar from '$lib/components/sales/SaleFilterBar.svelte';
	import SaleStatusTabs from '$lib/components/sales/SaleStatusTabs.svelte';
	import SaleFilterChips from '$lib/components/sales/SaleFilterChips.svelte';
	import SalesListView from '$lib/components/sales/SalesListView.svelte';
	import SalesGridView from '$lib/components/sales/SalesGridView.svelte';
	import SaleListFooter from '$lib/components/sales/SaleListFooter.svelte';
	import CancelSaleModal from '$lib/components/sales/CancelSaleModal.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { ReceiptText } from '@lucide/svelte';
	import { parseSaleStatuses, serializeSaleStatuses } from '$lib/components/sales/statusFilter';
	import {
		DEFAULT_SALE_LIST_PER_PAGE,
		DEFAULT_SALE_LIST_SORT,
		DEFAULT_SALE_LIST_VIEW,
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
	import { canOperate, SaleStatus, SALE_STATUS_LABELS } from '$lib/shared/enums';
	import type {
		SaleListItem,
		SaleWithRelations,
		SalesStats
	} from '$lib/server/db/queries/sales/types';
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
	async function fetchSales(nextPage: number): Promise<void> {
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
	const PRESET_LABELS: Record<string, string> = {
		today: 'Hoy',
		'7d': 'Últimos 7 días',
		month: 'Este mes',
		custom: 'Rango de fechas'
	};

	const chips = $derived.by(() => {
		const list: { id: string; label: string; onRemove: () => void }[] = [];
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
		void persistView(next);
	}

	async function persistView(next: SaleListView): Promise<void> {
		try {
			await saveUserPreference({ key: 'sales.view', value: next });
		} catch (e) {
			// La vista cambió igual; reintento silencioso (sin toast, sin error alarmante).
			logger.error('No se pudo guardar la preferencia de vista', e);
			setTimeout(() => {
				void saveUserPreference({ key: 'sales.view', value: next }).catch(() => undefined);
			}, 1500);
		}
	}

	// ── Navegación ───────────────────────────────────────────────────────────
	function handleView(sale: SaleWithRelations): void {
		void goto(resolve(`/sales/${sale.id}`));
	}

	beforeNavigate(({ to: next }) => {
		const path = next?.url.pathname ?? '';
		if (path !== '/sales' && path.startsWith('/sales')) {
			saveReferrerParams('/sales');
		}
	});
</script>

<svelte:head>
	<title>Ventas - Optikt</title>
</svelte:head>

<div
	class="animate-rise @container mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-5 pt-3.5 pb-7 min-[1440px]:max-w-[1440px] min-[1920px]:max-w-[1600px] min-[2400px]:max-w-[1920px]"
>
	<SaleListHeader
		totalCount={stats.total}
		{view}
		canCreate={canAct}
		onViewChange={handleViewChange}
	/>

	<SaleKpiCards {stats} onSelect={handleKpiSelect} />

	<section
		class="flex flex-col gap-2.5 rounded-[var(--ds-radius-lg)] bg-white p-2.5 shadow-[var(--ds-shadow-sm)] lg:p-3"
	>
		<SaleFilterBar
			{search}
			{sellerId}
			{sellers}
			{preset}
			{from}
			{to}
			{sort}
			toggles={{ cashea, shippingPending, freeItem, balance }}
			{activeToggleCount}
			onSearch={handleSearch}
			onSellerChange={handleSellerChange}
			onPresetChange={handlePresetChange}
			onRangeChange={handleRangeChange}
			onToggle={handleToggle}
			onSortChange={handleSortChange}
		/>

		<SaleStatusTabs counts={salesData.facets} value={statuses} onchange={handleStatusesChange} />

		<SaleFilterChips {chips} onClear={clearFilters} />
	</section>

	<p class="sr-only" aria-live="polite">{salesData.total} ventas</p>

	<div
		class="overflow-hidden rounded-[var(--ds-radius-lg)] bg-white shadow-[var(--ds-shadow-sm)] {loading &&
		salesData.sales.length > 0
			? 'pointer-events-none opacity-60'
			: ''}"
		aria-busy={loading}
	>
		{#if loading && salesData.sales.length === 0}
			{#if view === 'list'}
				<div class="h-[38px] border-b border-outline-variant/70 bg-surface-container-low"></div>
				{#each Array(7) as _, i (i)}
					<div class="flex h-[58px] items-center gap-4 border-b border-outline-variant/40 px-3">
						<div class="h-3 w-16 animate-pulse rounded bg-surface-container-high"></div>
						<div class="h-3 w-40 animate-pulse rounded bg-surface-container-high"></div>
						<div class="h-3 w-20 animate-pulse rounded bg-surface-container-high"></div>
						<div class="h-3 w-16 animate-pulse rounded bg-surface-container-high"></div>
						<div class="h-3 w-32 animate-pulse rounded bg-surface-container-high"></div>
					</div>
				{/each}
			{:else}
				<div class="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each Array(6) as _, i (i)}
						<div
							class="h-[132px] animate-pulse rounded-[var(--ds-radius-lg)] bg-surface-container-high"
						></div>
					{/each}
				</div>
			{/if}
		{:else if salesData.sales.length === 0}
			{#snippet receiptIcon()}
				<ReceiptText class="h-10 w-10" />
			{/snippet}
			<div class="flex flex-col items-center px-4 py-10">
				<EmptyState
					icon={receiptIcon}
					message={stats.total === 0
						? 'Registra una venta para comenzar'
						: 'No se encontraron ventas'}
				/>
				{#if stats.total > 0}
					<p class="-mt-2 text-[13px] text-on-surface-variant">
						Prueba con otros filtros o límpialos.
					</p>
				{/if}
				{#if chips.length > 0 || search.trim().length > 0}
					<button
						type="button"
						onclick={clearFilters}
						class="mt-3 inline-flex h-9 items-center rounded-[var(--ds-radius-md)] bg-brand-navy px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-navy-dark"
					>
						Limpiar filtros
					</button>
				{/if}
			</div>
		{:else}
			{#if view === 'list'}
				<!-- Mobile: ambas vistas usan el mismo layout de tarjetas (la tabla no cabe) -->
				<div class="p-3 lg:hidden">
					<SalesGridView
						sales={salesData.sales}
						canManage={canAct}
						currentUserId={data.user.id}
						currentUserRole={data.user.role}
						onOpen={handleView}
						onCancel={handleCancelRequest}
					/>
				</div>
				<div class="hidden lg:block">
					<SalesListView
						sales={salesData.sales}
						canManage={canAct}
						currentUserId={data.user.id}
						currentUserRole={data.user.role}
						onOpen={handleView}
						onCancel={handleCancelRequest}
					/>
				</div>
			{:else}
				<div class="p-3">
					<SalesGridView
						sales={salesData.sales}
						canManage={canAct}
						currentUserId={data.user.id}
						currentUserRole={data.user.role}
						onOpen={handleView}
						onCancel={handleCancelRequest}
					/>
				</div>
			{/if}

			<SaleListFooter
				page={salesData.page}
				perPage={salesData.perPage}
				total={salesData.total}
				totalPages={salesData.totalPages}
				selection={salesData.selection}
				showPerPage={view === 'list'}
				onPageChange={(next) => void fetchSales(next)}
				onPerPageChange={handlePerPageChange}
			/>
		{/if}
	</div>

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
