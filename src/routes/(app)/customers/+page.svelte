<script lang="ts">
	import { Plus, Search, UserPlus, TriangleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getErrorMessage } from '$lib/utils';
	import { listCustomers } from '$lib/remote/customers.remote';
	import { CustomersTable } from '$lib/components/customers';
	import { PageHeader } from '$lib/components/ui';
	import { canOperate } from '$lib/shared/enums';
	import type { Customer } from '$lib/server/db/schema';
	import type { PaginatedResult } from '$lib/types';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialCustomers, totalCount, newThisMonth, pendingSalesCustomers } = untrack(() => data);

	// Data state - initialize from server
	let customersData = $state<PaginatedResult<Customer>>({
		items: initialCustomers,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);
	const canAct = $derived(canOperate(data.user.role));

	// Filter state
	let search = $state('');
	let includeDeleted = $state(false);

	// Fetch customers (for filtering/pagination)
	async function fetchCustomers(page = 1) {
		loading = true;
		try {
			customersData = await listCustomers({
				page,
				perPage: 10,
				search: search || undefined,
				includeDeleted
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando clientes'));
		} finally {
			loading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchCustomers(1), 300);
	}
</script>

<svelte:head>
	<title>Clientes - Optikt</title>
</svelte:head>

<div class="p-6">
	<PageHeader title="Clientes" subtitle="Directorio">
		{#snippet actions()}
			{#if canAct}
				<button
					onclick={() => goto(resolve('/customers/new'))}
					class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md"
				>
					<Plus size={18} />
					NUEVO CLIENTE
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Search Container -->
	<div class="mb-6 flex flex-wrap items-stretch gap-4">
		<!-- Search Card -->
		<div class="glass-card flex-1 p-4">
			<p class="mb-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
				Búsqueda Avanzada
			</p>
			<div class="relative">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-outline" />
				<input
					type="search"
					placeholder="Buscar por nombre, cédula, teléfono o email..."
					bind:value={search}
					oninput={handleSearch}
					class="w-full rounded-lg border-none bg-surface-container-high p-3 pl-10 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				/>
			</div>
		</div>

		<!-- Filter Card -->
		<div class="glass-card flex w-56 flex-col justify-center p-4">
			<p class="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Filtros</p>
			<label class="flex items-center gap-2.5">
				<input
					type="checkbox"
					bind:checked={includeDeleted}
					onchange={() => fetchCustomers(1)}
					class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue"
				/>
				<span class="text-sm text-on-surface-variant">Mostrar eliminados</span>
			</label>
		</div>
	</div>

	<!-- Table + Pagination -->
	<CustomersTable
		customers={customersData.items}
		page={customersData.page}
		perPage={customersData.perPage}
		total={customersData.total}
		totalPages={customersData.totalPages}
		{loading}
		onRefresh={() => fetchCustomers(customersData.page)}
		onPageChange={fetchCustomers}
	/>

	<!-- Summary Cards -->
	<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="glass-card relative p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-brand-gold"
				>
					<UserPlus size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Nuevos Clientes</p>
			</div>
			<p class="font-heading text-3xl font-bold text-brand-navy">+{newThisMonth}</p>
			<p class="mt-2 text-sm text-on-surface-variant">Registrados este mes</p>
		</div>

		<div class="glass-card relative p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-error-container text-on-error-container"
				>
					<TriangleAlert size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">Pendientes</p>
			</div>
			<p class="font-heading text-3xl font-bold text-brand-navy">{pendingSalesCustomers}</p>
			<p class="mt-2 text-sm text-on-surface-variant">Clientes con ventas pendientes</p>
		</div>
	</div>
</div>
