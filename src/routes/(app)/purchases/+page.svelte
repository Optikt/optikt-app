<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ArrowRightLeft,
		CheckCircle2,
		Coins,
		FileClock,
		Plus,
		RotateCcw,
		Search
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { PurchaseOrdersTable } from '$lib/components/purchases';
	import { PageHeader } from '$lib/components/ui';
	import { listPurchaseOrders } from '$lib/remote/purchaseOrders.remote';
	import {
		ALL_PURCHASE_ORDER_STATUSES,
		PURCHASE_ORDER_STATUS_LABELS,
		type PurchaseOrderStatus
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
	let statusFilter = $state<PurchaseOrderStatus | ''>('');
	let supplierFilter = $state('');

	const hasActiveFilters = $derived(
		search.trim().length > 0 || statusFilter !== '' || supplierFilter !== ''
	);

	async function fetchPurchaseOrders(page = 1) {
		loading = true;
		try {
			purchaseOrdersData = await listPurchaseOrders({
				page,
				perPage: 10,
				search: search.trim() || undefined,
				status: statusFilter || undefined,
				supplierId: supplierFilter || undefined
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

	function clearFilters() {
		search = '';
		statusFilter = '';
		supplierFilter = '';
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
	<PageHeader title="Órdenes de Compra" subtitle="Compras e inventario">
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

	<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
		<p class="max-w-3xl text-sm leading-7 text-on-surface-variant sm:text-base">
			Gestiona cargas a proveedores, revisa qué órdenes siguen en borrador y confirma el ingreso de
			inventario con una vista clara de estados, tasas y trazabilidad operativa.
		</p>
		<div
			class="inline-flex items-center gap-2 self-start rounded-full bg-surface-container-high px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
		>
			{stats.total.toLocaleString('es-VE')} órdenes registradas
		</div>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
			</div>
			<p class="font-heading text-3xl font-bold text-brand-navy">
				{stats.confirmed.toLocaleString('es-VE')}
			</p>
		</section>

		<section class="rounded-xl bg-brand-navy p-5 shadow-sm">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/20 text-brand-gold"
				>
					<Coins class="h-5 w-5" />
				</div>
				<p class="text-xs font-semibold tracking-wider text-white/70 uppercase">Gasto del mes</p>
			</div>
			<p class="font-heading text-3xl font-bold text-white">{formatPrice(stats.monthlySpend)}</p>
			<p class="mt-1 text-sm text-white/70">Órdenes confirmadas del mes en USD BCV</p>
		</section>

		<section class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
				>
					<FileClock class="h-5 w-5" />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-warning-container uppercase">
					Borradores
				</p>
			</div>
			<p class="font-heading text-3xl font-bold text-brand-navy">
				{stats.draft.toLocaleString('es-VE')}
			</p>
		</section>
	</div>

	<section class="glass-card bg-surface-container-low p-4">
		<div class="grid gap-3 xl:grid-cols-[minmax(260px,1.1fr)_180px_220px_auto] xl:items-center">
			<div class="relative">
				<Search class="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline" />
				<input
					id="purchase-orders-search"
					name="purchase-orders-search"
					type="search"
					bind:value={search}
					oninput={handleSearch}
					placeholder="Buscar por PO-0001, factura o proveedor..."
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
				{#each ALL_PURCHASE_ORDER_STATUSES as status (status)}
					<option value={status}>{PURCHASE_ORDER_STATUS_LABELS[status]}</option>
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
