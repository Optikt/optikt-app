<script lang="ts">
	import { Button, Select, Toggle } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SearchInput, TablePagination } from '$lib/components/ui';
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
		<Button color="blue" onclick={openCreate}>
			<Plus class="mr-2 h-5 w-5" />
			Agregar Proveedor
		</Button>
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
		<Select bind:value={typeFilter} onchange={handleFilterChange} class="w-44">
			<option value="">Todos los tipos</option>
			{#each ALL_SUPPLIER_TYPES as t (t)}
				<option value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
			{/each}
		</Select>
		<Toggle
			bind:checked={includeDeleted}
			onchange={handleFilterChange}
			class="text-sm text-slate-600"
		>
			Mostrar eliminados
		</Toggle>
	</div>

	<!-- Table -->
	<SuppliersTable
		suppliers={suppliersData.items}
		{loading}
		onEdit={openEdit}
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
