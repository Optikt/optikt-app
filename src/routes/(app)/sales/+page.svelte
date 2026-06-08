<script lang="ts">
	import {
		CircleX,
		Clock3,
		Plus,
		ReceiptText,
		RotateCcw,
		Search,
		CircleCheck,
		Truck,
		Sparkles
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		getErrorMessage,
		parseBooleanParam,
		parsePageParam,
		replaceUrlSearch,
		setQueryParam
	} from '$lib/utils';
	import { listSales, getSalesStats } from '$lib/remote/sales.remote';
	import { SalesTable } from '$lib/components/sales';
	import { PageHeader } from '$lib/components/ui';
	import { canOperate } from '$lib/shared/enums';
	import { ALL_SALE_STATUSES, SALE_STATUS_LABELS, type SaleStatus } from '$lib/shared/enums';
	import type { SaleWithRelations, SalesStats } from '$lib/server/db/queries/sales';
	import type { PaginatedSales } from '$lib/remote/sales.remote';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialSales, totalCount, stats: initialStats } = untrack(() => data);
	const initialQuery = untrack(() => page.url.searchParams);
	const initialPage = parsePageParam(initialQuery.get('page'));
	const initialSearch = initialQuery.get('q') ?? '';
	const initialStatus = initialQuery.get('status');
	const initialShippingPending = parseBooleanParam(initialQuery.get('shippingPending'));
	const initialFreeItem = parseBooleanParam(initialQuery.get('freeItem'));

	function parseSaleStatus(value: string | null): SaleStatus | '' {
		if (!value) return '';
		return ALL_SALE_STATUSES.includes(value as SaleStatus) ? (value as SaleStatus) : '';
	}

	// Data state
	let salesData = $state<PaginatedSales>({
		sales: initialSales,
		total: totalCount,
		page: initialPage,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let stats = $state<SalesStats>(initialStats);
	let loading = $state(false);
	const canAct = $derived(canOperate(data.user.role));

	// Filter state
	let search = $state(initialSearch);
	let statusFilter = $state<SaleStatus | ''>(parseSaleStatus(initialStatus));
	let shippingPendingFilter = $state(initialShippingPending);
	let hasFreeItemFilter = $state(initialFreeItem);

	function syncUrl(nextPage: number): void {
		replaceUrlSearch(page.url, (params) => {
			setQueryParam(params, 'q', search.trim());
			setQueryParam(params, 'status', statusFilter || null);
			setQueryParam(params, 'shippingPending', shippingPendingFilter ? '1' : null);
			setQueryParam(params, 'freeItem', hasFreeItemFilter ? '1' : null);
			setQueryParam(params, 'page', nextPage > 1 ? nextPage : null);
		});
	}

	// Fetch sales
	async function fetchSales(page = 1) {
		syncUrl(page);
		loading = true;
		try {
			salesData = await listSales({
				page,
				perPage: 10,
				search: search || undefined,
				status: statusFilter || undefined,
				shippingCostPending: shippingPendingFilter || undefined,
				hasFreeItem: hasFreeItemFilter || undefined
			}).run();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando ventas'));
		} finally {
			loading = false;
		}
	}

	async function refreshStats() {
		try {
			stats = await getSalesStats({}).run();
		} catch (e) {
			console.error(e);
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			fetchSales(1);
		}, 300);
	}

	// Filter change
	function handleFilterChange() {
		fetchSales(1);
	}

	function clearFilters() {
		search = '';
		statusFilter = '';
		shippingPendingFilter = false;
		hasFreeItemFilter = false;
		fetchSales(1);
	}

	let hasActiveFilters = $derived(
		search.trim().length > 0 || statusFilter !== '' || shippingPendingFilter || hasFreeItemFilter
	);

	// Navigate to sale detail page
	function handleView(sale: SaleWithRelations) {
		goto(resolve(`/sales/${sale.id}`));
	}

	function getViewHref(sale: SaleWithRelations): `/sales/${string}` {
		return `/sales/${sale.id}`;
	}
</script>

<svelte:head>
	<title>Ventas - Optikt</title>
</svelte:head>

<div class="p-6">
	<PageHeader title="Ventas">
		{#snippet actions()}
			{#if canAct}
				<button
					onclick={() => goto(resolve('/sales/new'))}
					class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md"
				>
					<Plus size={18} />
					NUEVA VENTA
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-highest text-brand-navy"
				>
					<ReceiptText size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
					Ventas Mensuales
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">{stats.monthly}</p>
			</div>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
				>
					<Clock3 size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-warning-container uppercase">
					Ventas Pendientes
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">{stats.pending}</p>
			</div>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-container text-on-success-container"
				>
					<CircleCheck size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-success-container uppercase">
					Ventas Completadas
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">{stats.completed}</p>
			</div>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-error-container text-on-error-container"
				>
					<CircleX size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-error-container uppercase">
					Ventas Canceladas
				</p>
				<p class="font-heading text-3xl font-bold text-error">{stats.cancelled}</p>
			</div>
		</div>
	</div>

	<div
		class="glass-card mb-6 flex flex-col gap-4 bg-surface-container-low p-4 md:flex-row md:items-center"
	>
		<div class="relative flex-1">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-outline" />
			<input
				id="sales-search"
				name="sales-search"
				type="search"
				bind:value={search}
				oninput={handleSearch}
				placeholder="Buscar por cliente, vendedor o # de orden..."
				class="w-full rounded-lg border-none bg-surface-container-high p-3 pl-10 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			/>
		</div>

		<div class="flex w-full gap-3 md:w-auto">
			<select
				id="sales-status-filter"
				name="sales-status-filter"
				bind:value={statusFilter}
				onchange={handleFilterChange}
				class="min-w-[220px] flex-1 rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 md:flex-none"
			>
				<option value="">Todos los estados</option>
				{#each ALL_SALE_STATUSES as s (s)}
					<option value={s}>{SALE_STATUS_LABELS[s]}</option>
				{/each}
			</select>

			<button
				onclick={() => {
					shippingPendingFilter = !shippingPendingFilter;
					handleFilterChange();
				}}
				class="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors {shippingPendingFilter
					? 'bg-warning-container text-on-warning-container'
					: 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}"
				title="Filtrar ventas con envío pendiente"
			>
				<Truck size={16} />
				<span class="hidden sm:inline">Envío pendiente</span>
			</button>

			<button
				onclick={() => {
					hasFreeItemFilter = !hasFreeItemFilter;
					handleFilterChange();
				}}
				class="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors {hasFreeItemFilter
					? 'bg-amber-100 text-amber-700'
					: 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}"
				title="Filtrar ventas con ítems libres"
			>
				<Sparkles size={16} />
				<span class="hidden sm:inline">Ítem libre</span>
			</button>

			<button
				onclick={clearFilters}
				disabled={!hasActiveFilters}
				class="inline-flex h-[3rem] w-[3rem] items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 {hasActiveFilters
					? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
					: 'bg-surface-container-high text-outline'}"
				title="Limpiar filtros"
			>
				<RotateCcw size={18} />
			</button>
		</div>
	</div>

	<SalesTable
		sales={salesData.sales}
		page={salesData.page}
		perPage={salesData.perPage}
		total={salesData.total}
		totalPages={salesData.totalPages}
		{loading}
		canManage={canAct}
		currentUserId={data.user.id}
		currentUserRole={data.user.role}
		onView={handleView}
		{getViewHref}
		onRefresh={() => {
			fetchSales(salesData.page);
			refreshStats();
		}}
		onPageChange={(page) => fetchSales(page)}
	/>
</div>
