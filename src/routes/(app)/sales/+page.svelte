<script lang="ts">
	import { Button, Select } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SearchInput, TablePagination } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { listSales } from '$lib/remote/sales.remote';
	import { SalesTable } from '$lib/components/sales';
	import { ALL_SALE_STATUSES, SALE_STATUS_LABELS, type SaleStatus } from '$lib/shared/enums';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales';
	import type { PaginatedSales } from '$lib/remote/sales.remote';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialSales, totalCount } = untrack(() => data);

	// Data state
	let salesData = $state<PaginatedSales>({
		sales: initialSales,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	// Filter state
	let search = $state('');
	let statusFilter = $state<SaleStatus | ''>('');

	// Fetch sales
	async function fetchSales(page = 1) {
		loading = true;
		try {
			salesData = await listSales({
				page,
				perPage: 10,
				search: search || undefined,
				status: statusFilter || undefined
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando ventas'));
		} finally {
			loading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchSales(1), 300);
	}

	// Filter change
	function handleFilterChange() {
		fetchSales(1);
	}

	// Navigate to sale detail page
	function handleView(sale: SaleWithRelations) {
		goto(resolve(`/sales/${sale.id}`));
	}
</script>

<svelte:head>
	<title>Ventas - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-8 flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Ventas</h1>
			<p class="mt-1 text-base text-slate-500">Gestiona las ventas de la tienda</p>
		</div>
		<Button color="blue" size="lg" href="/sales/new">
			<Plus class="mr-2 h-5 w-5" />
			Nueva Venta
		</Button>
	</div>

	<!-- Filters -->
	<div
		class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
	>
		<SearchInput
			bind:value={search}
			placeholder="Buscar por cliente o vendedor..."
			oninput={handleSearch}
			class="min-w-64 flex-1"
		/>
		<Select bind:value={statusFilter} onchange={handleFilterChange} class="w-48">
			<option value="">Todos los estados</option>
			{#each ALL_SALE_STATUSES as s (s)}
				<option value={s}>{SALE_STATUS_LABELS[s]}</option>
			{/each}
		</Select>
	</div>

	<!-- Table -->
	<SalesTable
		sales={salesData.sales}
		{loading}
		onView={handleView}
		onRefresh={() => fetchSales(salesData.page)}
	/>

	<!-- Pagination -->
	<TablePagination
		page={salesData.page}
		perPage={salesData.perPage}
		total={salesData.total}
		totalPages={salesData.totalPages}
		onPageChange={(p) => fetchSales(p)}
	/>
</div>
