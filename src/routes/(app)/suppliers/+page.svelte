<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SearchInput, TablePagination } from '$lib/components/ui';
	import { isAdminRole } from '$lib/shared/enums';
	import { getErrorMessage } from '$lib/utils';
	import { listSuppliers } from '$lib/remote/suppliers.remote';
	import { SuppliersTable, SupplierFormModal } from '$lib/components/suppliers';
	import { ALL_SUPPLIER_TYPES, SUPPLIER_TYPE_LABELS, SupplierType } from '$lib/shared/enums';
	import type { Supplier } from '$lib/server/db/schema';
	import type { PaginatedResult } from '$lib/types';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialSuppliers, totalCount } = untrack(() => data);

	// Data state - initialize from server
	let suppliersData = $state<PaginatedResult<Supplier>>({
		items: initialSuppliers,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);
	const isAdmin = $derived(isAdminRole(data.user.role));

	// Filter state
	let search = $state('');
	let typeFilter = $state<SupplierType | ''>('');
	let includeDeleted = $state(false);
	// Form modal state
	let showFormModal = $state(false);
	let selectedSupplier = $state<Supplier | null>(null);

	// Fetch suppliers (for filtering/pagination)
	async function fetchSuppliers(page = 1) {
		loading = true;
		try {
			suppliersData = await listSuppliers({
				page,
				perPage: 10,
				search: search || undefined,
				type: typeFilter || undefined,
				includeDeleted
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando proveedores'));
		} finally {
			loading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchSuppliers(1), 300);
	}

	// Filter change
	function handleFilterChange() {
		fetchSuppliers(1);
	}

	// Modal handlers
	function openCreate() {
		selectedSupplier = null;
		showFormModal = true;
	}

	function openEdit(supplier: Supplier) {
		selectedSupplier = supplier;
		showFormModal = true;
	}

	function handleFormSuccess() {
		showFormModal = false;
		fetchSuppliers(suppliersData.page);
	}
</script>

<svelte:head>
	<title>Proveedores - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Proveedores</h1>
			<p class="text-slate-500">Gestiona los proveedores del sistema</p>
		</div>
		{#if isAdmin}
			<Button onclick={openCreate}>
				<Plus class="mr-2 h-5 w-5" />
				Agregar Proveedor
			</Button>
		{/if}
	</div>

	<!-- Filters -->
	<div
		class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
	>
		<SearchInput
			bind:value={search}
			placeholder="Buscar por nombre, RIF o teléfono..."
			oninput={handleSearch}
			class="min-w-64 flex-1"
		/>
		<select
			bind:value={typeFilter}
			onchange={handleFilterChange}
			class="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand-blue focus:outline-none"
		>
			<option value="">Todos los tipos</option>
			{#each ALL_SUPPLIER_TYPES as t (t)}
				<option value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
			{/each}
		</select>
		<label class="flex items-center gap-2 text-sm text-slate-600">
			<input
				type="checkbox"
				bind:checked={includeDeleted}
				onchange={handleFilterChange}
				class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-2 focus:ring-brand-blue"
			/>
			Mostrar eliminados
		</label>
	</div>

	<!-- Table -->
	<SuppliersTable
		suppliers={suppliersData.items}
		{loading}
		onEdit={openEdit}
		canManage={isAdmin}
		onRefresh={() => fetchSuppliers(suppliersData.page)}
	/>

	<!-- Pagination -->
	<TablePagination
		page={suppliersData.page}
		perPage={suppliersData.perPage}
		total={suppliersData.total}
		totalPages={suppliersData.totalPages}
		onPageChange={(p) => fetchSuppliers(p)}
	/>
</div>

<!-- Create/Update Form Modal -->
<SupplierFormModal
	bind:open={showFormModal}
	supplier={selectedSupplier}
	onSuccess={handleFormSuccess}
	onClose={() => (showFormModal = false)}
/>
