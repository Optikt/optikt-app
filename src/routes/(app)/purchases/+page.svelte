<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ArrowRightLeft,
		ArrowDownWideNarrow,
		ArrowUpWideNarrow,
		ClipboardCheck,
		CheckCircle2,
		Coins,
		FileClock,
		Plus,
		RotateCcw,
		Search,
		Wallet
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { PurchaseOrdersTable } from '$lib/components/purchases';
	import { PageHeader } from '$lib/components/ui';
	import { listPurchaseOrders } from '$lib/remote/purchaseOrders.remote';
	import {
		PURCHASE_ORDER_STATUS_LABELS,
		PURCHASE_ORDER_UI_STATE_LABELS,
		PurchaseOrderStatus,
		PurchaseOrderUiState
	} from '$lib/shared/enums';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';
	import type { PaginatedResult } from '$lib/types';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';

	let { data }: { data: PageData } = $props();
	let { initialPurchaseOrders, totalCount, suppliers, stats } = untrack(() => data);

	let purchaseOrdersData = $state<PaginatedResult<PurchaseOrderWithRelations>>({
		items: initialPurchaseOrders,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	let search = $state('');
	let pendingBalanceFilter = $state(false);
	type PurchaseOrderStatusFilter =
		| PurchaseOrderStatus
		| PurchaseOrderUiState.DRAFT_IN_PROGRESS
		| PurchaseOrderUiState.DRAFT_READY
		| '';

	let statusFilter = $state<PurchaseOrderStatusFilter>('');
	let supplierFilter = $state('');
	type PurchaseOrderSortField = 'orderNumber' | 'orderDate' | 'createdAt' | 'status';
	type SortDirection = 'asc' | 'desc';
	let orderBy = $state<PurchaseOrderSortField>('orderNumber');
	let orderSort = $state<SortDirection>('desc');

	const statusFilterOptions = [
		{
			value: PurchaseOrderUiState.DRAFT_IN_PROGRESS,
			label: PURCHASE_ORDER_UI_STATE_LABELS.DRAFT_IN_PROGRESS
		},
		{ value: PurchaseOrderUiState.DRAFT_READY, label: PURCHASE_ORDER_UI_STATE_LABELS.DRAFT_READY },
		{ value: PurchaseOrderStatus.CONFIRMED, label: PURCHASE_ORDER_STATUS_LABELS.CONFIRMED },
		{ value: PurchaseOrderStatus.CANCELLED, label: PURCHASE_ORDER_STATUS_LABELS.CANCELLED }
	];
	const sortFieldOptions: { value: PurchaseOrderSortField; label: string }[] = [
		{ value: 'orderNumber', label: 'N.º orden' },
		{ value: 'orderDate', label: 'Fecha orden' },
		{ value: 'createdAt', label: 'Fecha creación' },
		{ value: 'status', label: 'Estado' }
	];

	const hasActiveFilters = $derived(
		search.trim().length > 0 ||
			statusFilter !== '' ||
			supplierFilter !== '' ||
			pendingBalanceFilter ||
			orderBy !== 'orderNumber' ||
			orderSort !== 'desc'
	);

	async function fetchPurchaseOrders(page = 1) {
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
				orderBy,
				orderSort
			}).run();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error cargando órdenes de compra'));
		} finally {
			loading = false;
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			void fetchPurchaseOrders(1);
		}, 250);
	}

	function handleFilterChange() {
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
</script>

<svelte:head>
	<title>Órdenes de Compra - Optikt</title>
</svelte:head>

<div class="space-y-6 p-6">
	<PageHeader title="Órdenes de Compra">
		{#snippet actions()}
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
		{/snippet}
	</PageHeader>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<section class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-success-container text-on-success-container"
				>
					<CheckCircle2 class="h-5 w-5" />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-success-container uppercase">
					Confirmadas
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">
					{stats.confirmed.toLocaleString('es-VE')}
				</p>
			</div>
		</section>

		<section class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-high text-brand-navy"
				>
					<FileClock class="h-5 w-5" />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
					En preparación
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">
					{stats.draftInProgress.toLocaleString('es-VE')}
				</p>
			</div>
		</section>

		<section class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
				>
					<ClipboardCheck class="h-5 w-5" />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-warning-container uppercase">
					Listas
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">
					{stats.draftReady.toLocaleString('es-VE')}
				</p>
			</div>
		</section>

		<section class="rounded-xl bg-brand-navy p-5 shadow-sm">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/20 text-brand-gold"
				>
					<Coins class="h-5 w-5" />
				</div>
				<p class="text-xs font-semibold tracking-wider text-white/70 uppercase">Gasto del mes</p>
				<p class="font-heading text-3xl font-bold text-white">{formatPrice(stats.monthlySpend)}</p>
			</div>
			<p class="mt-1 text-sm text-white/70">Órdenes confirmadas del mes en USD BCV</p>
		</section>
	</div>

	<section class="glass-card bg-surface-container-low p-4">
		<div
			class="grid gap-3 xl:grid-cols-[minmax(260px,1.1fr)_180px_220px_auto_180px_auto_auto] xl:items-center"
		>
			<div class="relative">
				<Search class="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline" />
				<input
					id="purchase-orders-search"
					name="purchase-orders-search"
					type="search"
					bind:value={search}
					oninput={handleSearch}
					placeholder="Buscar por PO-0001, documento o proveedor..."
					class="w-full rounded-lg border-none bg-surface-container-high p-3 pl-11 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				/>
			</div>

			<select
				id="purchase-status-filter"
				name="purchase-status-filter"
				bind:value={statusFilter}
				onchange={handleFilterChange}
				class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			>
				<option value="">Estado</option>
				{#each statusFilterOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>

			<select
				id="purchase-supplier-filter"
				name="purchase-supplier-filter"
				bind:value={supplierFilter}
				onchange={handleFilterChange}
				class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			>
				<option value="">Proveedor</option>
				{#each suppliers as supplier (supplier.id)}
					<option value={supplier.id}>{supplier.name}</option>
				{/each}
			</select>

			<button
				type="button"
				onclick={() => {
					pendingBalanceFilter = !pendingBalanceFilter;
					void fetchPurchaseOrders(1);
				}}
				class="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors {pendingBalanceFilter
					? 'bg-brand-navy text-white'
					: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
				title={pendingBalanceFilter ? 'Mostrando solo con saldo pendiente' : 'Mostrar solo con saldo pendiente'}
			>
				<Wallet class="h-4 w-4" />
				Saldo pendiente
			</button>

			<select
				id="purchase-order-sort-field"
				name="purchase-order-sort-field"
				bind:value={orderBy}
				onchange={handleFilterChange}
				class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				aria-label="Ordenar órdenes de compra por"
			>
				{#each sortFieldOptions as option (option.value)}
					<option value={option.value}>Orden: {option.label}</option>
				{/each}
			</select>

			<button
				type="button"
				onclick={toggleSortDirection}
				class="inline-flex h-[3rem] w-[3rem] items-center justify-center rounded-lg bg-surface-container-high text-brand-navy transition-colors hover:bg-surface-container-highest"
				aria-label={orderSort === 'desc' ? 'Orden descendente' : 'Orden ascendente'}
				title={orderSort === 'desc' ? 'Descendente' : 'Ascendente'}
			>
				{#if orderSort === 'desc'}
					<ArrowDownWideNarrow class="h-4 w-4" />
				{:else}
					<ArrowUpWideNarrow class="h-4 w-4" />
				{/if}
			</button>

			<button
				type="button"
				onclick={clearFilters}
				disabled={!hasActiveFilters}
				class="inline-flex h-[3rem] w-[3rem] items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 xl:justify-self-end {hasActiveFilters
					? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
					: 'bg-surface-container-high text-outline'}"
				aria-label="Limpiar filtros"
				title="Limpiar filtros"
			>
				<RotateCcw class="h-4 w-4" />
			</button>
		</div>
	</section>

	<PurchaseOrdersTable
		purchaseOrders={purchaseOrdersData.items}
		page={purchaseOrdersData.page}
		perPage={purchaseOrdersData.perPage}
		total={purchaseOrdersData.total}
		totalPages={purchaseOrdersData.totalPages}
		{loading}
		onView={handleView}
		onPageChange={(page) => void fetchPurchaseOrders(page)}
	/>
</div>
