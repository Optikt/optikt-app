<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SearchInput, TablePagination } from '$lib/components/ui';
	import { isAdminRole } from '$lib/shared/enums';
	import { getErrorMessage } from '$lib/utils';
	import { listMaterials } from '$lib/remote/materials.remote';
	import { MaterialFormModal, MaterialsTable } from '$lib/components/materials';
	import {
		MATERIAL_CATEGORIES,
		MATERIAL_CATEGORY_LABELS,
		type MaterialCategory
	} from '$lib/shared/enums/productTypes';
	import type { Material } from '$lib/server/db/schema';
	import type { PaginatedResult } from '$lib/types';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialMaterials, totalCount } = untrack(() => data);

	// Data state - initialize from server
	let materialsData = $state<PaginatedResult<Material>>({
		items: initialMaterials,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);
	const isAdmin = $derived(isAdminRole(data.user.role));

	// Filter state
	let search = $state('');
	let productTypeFilter = $state('');
	let includeDeleted = $state(false);

	// Form modal state
	let showFormModal = $state(false);
	let selectedMaterial = $state<Material | null>(null);

	// Fetch materials (for filtering/pagination)
	async function fetchMaterials(page = 1) {
		loading = true;
		try {
			materialsData = await listMaterials({
				page,
				perPage: 10,
				search: search || undefined,
				productType: (productTypeFilter as MaterialCategory) || undefined,
				includeDeleted
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando materiales'));
		} finally {
			loading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchMaterials(1), 300);
	}

	// Filter change
	function handleFilterChange() {
		fetchMaterials(1);
	}

	// Modal handlers
	function openCreate() {
		selectedMaterial = null;
		showFormModal = true;
	}

	function openEdit(material: Material) {
		selectedMaterial = material;
		showFormModal = true;
	}

	function handleFormSuccess() {
		showFormModal = false;
		fetchMaterials(materialsData.page);
	}
</script>

<svelte:head>
	<title>Materiales - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Materiales</h1>
			<p class="text-slate-500">Gestiona el catálogo de materiales de productos</p>
		</div>
		{#if isAdmin}
			<Button onclick={openCreate}>
				<Plus class="mr-2 h-5 w-5" />
				Agregar Material
			</Button>
		{/if}
	</div>

	<!-- Filters -->
	<div
		class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
	>
		<SearchInput
			bind:value={search}
			placeholder="Buscar por nombre o código..."
			oninput={handleSearch}
			class="min-w-64 flex-1"
		/>
		<select bind:value={productTypeFilter} onchange={handleFilterChange} class="w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue">
			<option value="">Todos los tipos</option>
			{#each MATERIAL_CATEGORIES as t (t)}
				<option value={t}>{MATERIAL_CATEGORY_LABELS[t]}</option>
			{/each}
		</select>
		<label class="flex items-center gap-2 text-sm text-slate-600">
		<input type="checkbox" bind:checked={includeDeleted} onchange={handleFilterChange} class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-2 focus:ring-brand-blue" />
		Mostrar eliminados
	</label>
	</div>

	<!-- Table -->
	<MaterialsTable
		materials={materialsData.items}
		{loading}
		onEdit={openEdit}
		canManage={isAdmin}
		onRefresh={() => fetchMaterials(materialsData.page)}
	/>

	<!-- Pagination -->
	<TablePagination
		page={materialsData.page}
		perPage={materialsData.perPage}
		total={materialsData.total}
		totalPages={materialsData.totalPages}
		onPageChange={(p) => fetchMaterials(p)}
	/>
</div>

<!-- Create/Update Form Modal -->
<MaterialFormModal
	bind:open={showFormModal}
	material={selectedMaterial}
	onSuccess={handleFormSuccess}
	onClose={() => (showFormModal = false)}
/>
