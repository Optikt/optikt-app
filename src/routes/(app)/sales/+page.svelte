<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		getErrorMessage,
		logger,
		parseBooleanParam,
		parsePageParam,
		replaceUrlSearch,
		saveReferrerParams,
		setQueryParam
	} from '$lib/utils';
	import { listSales, getSalesStats } from '$lib/remote/sales.remote';
	import { SaleFilterBar, SalesTable, SaleStatsCards } from '$lib/components/sales';
	import { PageHeader } from '$lib/components/ui';
	import { canOperate, ALL_SALE_STATUSES } from '$lib/shared/enums';
	import type { SaleStatus } from '$lib/shared/enums';
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
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando ventas'));
		} finally {
			loading = false;
		}
	}

	async function refreshStats() {
		try {
			stats = await getSalesStats({});
		} catch (e) {
			logger.error('Error cargando estadísticas de ventas', e);
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleSearch(value: string) {
		search = value;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			void fetchSales(1);
		}, 300);
	}

	function handleStatusChange(value: string) {
		statusFilter = parseSaleStatus(value || null);
		void fetchSales(1);
	}

	function toggleShippingPending() {
		shippingPendingFilter = !shippingPendingFilter;
		void fetchSales(1);
	}

	function toggleFreeItem() {
		hasFreeItemFilter = !hasFreeItemFilter;
		void fetchSales(1);
	}

	function clearFilters() {
		search = '';
		statusFilter = '';
		shippingPendingFilter = false;
		hasFreeItemFilter = false;
		void fetchSales(1);
	}

	let hasActiveFilters = $derived(
		search.trim().length > 0 || statusFilter !== '' || shippingPendingFilter || hasFreeItemFilter
	);

	function handleView(sale: SaleWithRelations) {
		void goto(resolve(`/sales/${sale.id}`));
	}

	function getViewHref(sale: SaleWithRelations): `/sales/${string}` {
		return `/sales/${sale.id}`;
	}

	beforeNavigate(({ to }) => {
		const path = to?.url.pathname ?? '';
		if (path !== '/sales' && path.startsWith('/sales')) {
			saveReferrerParams('/sales');
		}
	});
</script>

<svelte:head>
	<title>Ventas - Optikt</title>
</svelte:head>

<div class="flex flex-col gap-1 p-4">
	<div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
			<PageHeader title="Ventas" />
			<SaleStatsCards {stats} />
		</div>
		{#if canAct}
			<button
				onclick={() => goto(resolve('/sales/new'))}
				class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md sm:gap-2 sm:px-4 sm:text-sm"
			>
				<Plus size={16} />
				NUEVA VENTA
			</button>
		{/if}
	</div>

	<SaleFilterBar
		{search}
		{statusFilter}
		{shippingPendingFilter}
		{hasFreeItemFilter}
		{hasActiveFilters}
		onSearch={handleSearch}
		onStatusChange={handleStatusChange}
		onToggleShippingPending={toggleShippingPending}
		onToggleFreeItem={toggleFreeItem}
		onClearFilters={clearFilters}
	/>

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
			void fetchSales(salesData.page);
			void refreshStats();
		}}
		onPageChange={(page) => void fetchSales(page)}
	/>
</div>
