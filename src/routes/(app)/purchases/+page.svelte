<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ArrowRightLeft, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { PurchaseFilterBar, PurchaseOrdersTable } from '$lib/components/purchases';
	import { listPurchaseOrders } from '$lib/remote/purchaseOrders.remote';
	import { PurchaseOrderStatus, PurchaseOrderUiState } from '$lib/shared/enums';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';
	import type { PaginatedResult } from '$lib/types';
	import {
		getErrorMessage,
		parseBooleanParam,
		parsePageParam,
		replaceUrlSearch,
		setQueryParam,
		formatPrice
	} from '$lib/utils';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';

	let { data }: { data: PageData } = $props();
	let { initialPurchaseOrders, totalCount, suppliers, stats } = untrack(() => data);
	const initialQuery = untrack(() => page.url.searchParams);
	const initialPage = parsePageParam(initialQuery.get('page'));
	const initialSearch = initialQuery.get('q') ?? '';
	const initialStatus = initialQuery.get('status') ?? '';
	const initialSupplier = initialQuery.get('supplier') ?? '';
	const initialPending = parseBooleanParam(initialQuery.get('pending'));
	const initialOverdue = parseBooleanParam(initialQuery.get('overdue'));
	const initialOrderBy = initialQuery.get('orderBy');
	const initialOrderSort = initialQuery.get('orderSort');

	let purchaseOrdersData = $state<PaginatedResult<PurchaseOrderWithRelations>>({
		items: initialPurchaseOrders,
		total: totalCount,
		page: initialPage,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	let search = $state(initialSearch);
	let pendingBalanceFilter = $state(initialPending);
	let overdueBalanceFilter = $state(initialOverdue);
	type PurchaseOrderStatusFilter =
		| PurchaseOrderStatus
		| PurchaseOrderUiState.DRAFT_IN_PROGRESS
		| PurchaseOrderUiState.DRAFT_READY
		| '';

	let statusFilter = $state<PurchaseOrderStatusFilter>(
		initialStatus === PurchaseOrderUiState.DRAFT_IN_PROGRESS ||
			initialStatus === PurchaseOrderUiState.DRAFT_READY ||
			initialStatus === PurchaseOrderStatus.DRAFT ||
			initialStatus === PurchaseOrderStatus.CONFIRMED ||
			initialStatus === PurchaseOrderStatus.CANCELLED
			? (initialStatus as PurchaseOrderStatusFilter)
			: ''
	);
	let supplierFilter = $state(initialSupplier);
	type PurchaseOrderSortField = 'orderNumber' | 'orderDate' | 'createdAt' | 'status';
	type SortDirection = 'asc' | 'desc';
	let orderBy = $state<PurchaseOrderSortField>(
		initialOrderBy === 'orderDate' ||
			initialOrderBy === 'createdAt' ||
			initialOrderBy === 'status' ||
			initialOrderBy === 'orderNumber'
			? initialOrderBy
			: 'orderNumber'
	);
	let orderSort = $state<SortDirection>(initialOrderSort === 'asc' ? 'asc' : 'desc');

	function syncUrl(nextPage: number): void {
		replaceUrlSearch(page.url, (params) => {
			setQueryParam(params, 'q', search.trim());
			setQueryParam(params, 'status', statusFilter || null);
			setQueryParam(params, 'supplier', supplierFilter || null);
			setQueryParam(params, 'pending', pendingBalanceFilter ? '1' : null);
			setQueryParam(params, 'overdue', overdueBalanceFilter ? '1' : null);
			setQueryParam(params, 'orderBy', orderBy === 'orderNumber' ? null : orderBy);
			setQueryParam(params, 'orderSort', orderSort === 'desc' ? null : orderSort);
			setQueryParam(params, 'page', nextPage > 1 ? nextPage : null);
		});
	}

	const hasActiveFilters = $derived(
		search.trim().length > 0 ||
			statusFilter !== '' ||
			supplierFilter !== '' ||
			pendingBalanceFilter ||
			overdueBalanceFilter ||
			orderBy !== 'orderNumber' ||
			orderSort !== 'desc'
	);

	async function fetchPurchaseOrders(page = 1) {
		syncUrl(page);
		loading = true;
		const draftInProgress = statusFilter === PurchaseOrderUiState.DRAFT_IN_PROGRESS;
		const draftReady = statusFilter === PurchaseOrderUiState.DRAFT_READY;
		let status: PurchaseOrderStatus | undefined;
		let readyForReview: boolean | undefined;

		if (draftInProgress) {
			status = PurchaseOrderStatus.DRAFT;
			readyForReview = false;
		} else if (draftReady) {
			status = PurchaseOrderStatus.DRAFT;
			readyForReview = true;
		} else if (
			statusFilter === PurchaseOrderStatus.DRAFT ||
			statusFilter === PurchaseOrderStatus.CONFIRMED ||
			statusFilter === PurchaseOrderStatus.CANCELLED
		) {
			status = statusFilter;
		} else {
			status = undefined;
		}

		try {
			purchaseOrdersData = await listPurchaseOrders({
				page,
				perPage: 10,
				search: search.trim() || undefined,
				status,
				readyForReview,
				supplierId: supplierFilter || undefined,
				hasPendingBalance: pendingBalanceFilter ? true : undefined,
				hasOverdueBalance: overdueBalanceFilter ? true : undefined,
				orderBy,
				orderSort
			});
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error cargando órdenes de compra'));
		} finally {
			loading = false;
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	function handleSearch(value: string) {
		search = value;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			void fetchPurchaseOrders(1);
		}, 250);
	}

	function handleStatusChange(value: PurchaseOrderStatusFilter) {
		statusFilter = value;
		void fetchPurchaseOrders(1);
	}

	function handleSupplierChange(value: string) {
		supplierFilter = value;
		void fetchPurchaseOrders(1);
	}

	function togglePending() {
		pendingBalanceFilter = !pendingBalanceFilter;
		void fetchPurchaseOrders(1);
	}

	function toggleOverdue() {
		overdueBalanceFilter = !overdueBalanceFilter;
		if (overdueBalanceFilter) pendingBalanceFilter = true;
		void fetchPurchaseOrders(1);
	}

	function handleSortFieldChange(value: PurchaseOrderSortField) {
		orderBy = value;
		void fetchPurchaseOrders(1);
	}

	function toggleSortDirection() {
		orderSort = orderSort === 'desc' ? 'asc' : 'desc';
		void fetchPurchaseOrders(1);
	}

	function clearFilters() {
		search = '';
		statusFilter = '';
		supplierFilter = '';
		pendingBalanceFilter = false;
		overdueBalanceFilter = false;
		orderBy = 'orderNumber';
		orderSort = 'desc';
		void fetchPurchaseOrders(1);
	}

	function openCreate() {
		void goto(resolve('/purchases/new'));
	}

	function openMovements() {
		void goto(resolve('/purchases/movements'));
	}

	function handleView(purchaseOrder: PurchaseOrderWithRelations) {
		void goto(resolve(`/purchases/${purchaseOrder.id}`));
	}

	function getViewHref(purchaseOrder: PurchaseOrderWithRelations): `/purchases/${string}` {
		return `/purchases/${purchaseOrder.id}`;
	}
</script>

<svelte:head>
	<title>Órdenes de Compra - Optikt</title>
</svelte:head>

<div class="space-y-3 p-3">
	<header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0">
			<h1 class="text-xl font-bold text-brand-navy">Órdenes de Compra</h1>
			{#if stats}
				<div
					class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant"
				>
					<span class="font-semibold text-brand-navy">{stats.confirmed}</span>
					<span>confirmadas</span>
					<span class="text-outline">·</span>
					<span class="font-semibold text-brand-navy">{stats.draftInProgress}</span>
					<span>en prep.</span>
					<span class="text-outline">·</span>
					<span class="font-semibold text-brand-navy">{stats.draftReady}</span>
					<span>listas</span>
					<span class="text-outline">·</span>
					<span class="font-semibold text-brand-navy">{formatPrice(stats.monthlySpend)}</span>
					<span class="text-outline hidden xl:inline">recibido este mes</span>
				</div>
			{/if}
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<button
				type="button"
				onclick={openMovements}
				class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-brand-navy shadow-sm ring-1 ring-outline-variant/30 transition-colors hover:bg-surface-container-high"
			>
				<ArrowRightLeft class="h-4 w-4" />
				Movimientos
			</button>
			<button
				type="button"
				onclick={openCreate}
				class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark"
			>
				<Plus class="h-4 w-4" />
				Nueva orden
			</button>
		</div>
	</header>

	<PurchaseFilterBar
		{search}
		{statusFilter}
		{supplierFilter}
		{pendingBalanceFilter}
		{overdueBalanceFilter}
		{orderBy}
		{orderSort}
		{hasActiveFilters}
		{suppliers}
		onSearch={handleSearch}
		onStatusChange={handleStatusChange}
		onSupplierChange={handleSupplierChange}
		onTogglePending={togglePending}
		onToggleOverdue={toggleOverdue}
		onSortFieldChange={handleSortFieldChange}
		onToggleSortDirection={toggleSortDirection}
		onClearFilters={clearFilters}
	/>

	<PurchaseOrdersTable
		purchaseOrders={purchaseOrdersData.items}
		page={purchaseOrdersData.page}
		perPage={purchaseOrdersData.perPage}
		total={purchaseOrdersData.total}
		totalPages={purchaseOrdersData.totalPages}
		{loading}
		onView={handleView}
		{getViewHref}
		onPageChange={(page) => void fetchPurchaseOrders(page)}
	/>
</div>
