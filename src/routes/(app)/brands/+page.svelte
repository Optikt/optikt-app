<script lang="ts">
	import { Button, Toggle } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SearchInput, TablePagination } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { listBrands } from '$lib/remote/brands.remote';
	import { BrandsTable, BrandFormModal } from '$lib/components/brands';
	import type { Brand } from '$lib/server/db/schema';
	import type { PaginatedResult } from '$lib/types';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialBrands, totalCount } = untrack(() => data);

	// Data state - initialize from server
	let brandsData = $state<PaginatedResult<Brand>>({
		items: initialBrands,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	// Filter state
	let search = $state('');
	let includeDeleted = $state(false);
	// Form modal state
	let showFormModal = $state(false);
	let selectedBrand = $state<Brand | null>(null);

	// Fetch brands (for filtering/pagination)
	async function fetchBrands(page = 1) {
		loading = true;
		try {
			brandsData = await listBrands({
				page,
				perPage: 10,
				search: search || undefined,
				includeDeleted
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando marcas'));
		} finally {
			loading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchBrands(1), 300);
	}

	// Modal handlers
	function openCreate() {
		selectedBrand = null;
		showFormModal = true;
	}

	function openEdit(brand: Brand) {
		selectedBrand = brand;
		showFormModal = true;
	}

	function handleFormSuccess() {
		showFormModal = false;
		fetchBrands(brandsData.page);
	}
</script>

<svelte:head>
	<title>Marcas - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Marcas</h1>
			<p class="text-slate-500">Gestiona el catálogo de marcas</p>
		</div>
		<Button color="blue" onclick={openCreate}>
			<Plus class="mr-2 h-5 w-5" />
			Agregar Marca
		</Button>
	</div>

	<!-- Filters -->
	<div
		class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
	>
		<SearchInput
			bind:value={search}
			placeholder="Buscar por nombre o país..."
			oninput={handleSearch}
			class="min-w-64 flex-1"
		/>
		<Toggle
			bind:checked={includeDeleted}
			onchange={() => fetchBrands(1)}
			class="text-sm text-slate-600"
		>
			Mostrar eliminados
		</Toggle>
	</div>

	<!-- Table -->
	<BrandsTable
		brands={brandsData.items}
		{loading}
		onEdit={openEdit}
		onRefresh={() => fetchBrands(brandsData.page)}
	/>

	<!-- Pagination -->
	<TablePagination
		page={brandsData.page}
		perPage={brandsData.perPage}
		total={brandsData.total}
		totalPages={brandsData.totalPages}
		onPageChange={(p) => fetchBrands(p)}
	/>
</div>

<!-- Create/Update Form Modal -->
<BrandFormModal
	bind:open={showFormModal}
	brand={selectedBrand}
	onSuccess={handleFormSuccess}
	onClose={() => (showFormModal = false)}
/>
