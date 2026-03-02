<script lang="ts">
	import { Button, Select, Toggle } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SearchInput, TablePagination } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { listProducts } from '$lib/remote/products.remote';
	import { ProductsTable } from '$lib/components/products';
	import { ALL_PRODUCT_TYPES, PRODUCT_TYPE_LABELS, ProductType } from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { PaginatedProducts } from '$lib/remote/products.remote';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialProducts, totalCount, brands, suppliers } = untrack(() => data);

	// Data state - initialize from server
	let productsData = $state<PaginatedProducts>({
		products: initialProducts as ProductWithRelations[],
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	// Filter state
	let search = $state('');
	let typeFilter = $state<ProductType>();
	let brandFilter = $state('');
	let supplierFilter = $state('');
	let includeDeleted = $state(false);

	// Fetch products (for filtering/pagination)
	async function fetchProducts(page = 1) {
		loading = true;
		try {
			productsData = await listProducts({
				page,
				perPage: 10,
				search: search || undefined,
				type: typeFilter || undefined,
				brandId: brandFilter || undefined,
				supplierId: supplierFilter || undefined,
				includeDeleted
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando productos'));
		} finally {
			loading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchProducts(1), 300);
	}

	// Filter change
	function handleFilterChange() {
		fetchProducts(1);
	}

	// Navigate to edit page
	function handleEdit(product: ProductWithRelations) {
		goto(resolve(`/(app)/products/[id]/update`, { id: product.id }));
	}
</script>

<svelte:head>
	<title>Inventario - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Inventario</h1>
			<p class="text-slate-500">Gestiona el inventario de productos</p>
		</div>
		<Button color="blue" href="/products/create">
			<Plus class="mr-2 h-5 w-5" />
			Agregar Producto
		</Button>
	</div>

	<!-- Filters -->
	<div
		class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
	>
		<SearchInput
			bind:value={search}
			placeholder="Buscar por nombre o SKU..."
			oninput={handleSearch}
			class="min-w-64 flex-1"
		/>
		<Select bind:value={typeFilter} onchange={handleFilterChange} class="w-40">
			<option value={undefined}>Todos los tipos</option>
			{#each ALL_PRODUCT_TYPES as t (t)}
				<option value={t}>{PRODUCT_TYPE_LABELS[t]}</option>
			{/each}
		</Select>
		<Select bind:value={brandFilter} onchange={handleFilterChange} class="w-40">
			<option value="">Todas las marcas</option>
			{#each brands as brand (brand.id)}
				<option value={brand.id}>{brand.name}</option>
			{/each}
		</Select>
		<Select bind:value={supplierFilter} onchange={handleFilterChange} class="w-44">
			<option value="">Todos los proveedores</option>
			{#each suppliers as supplier (supplier.id)}
				<option value={supplier.id}>{supplier.name}</option>
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
	<ProductsTable
		products={productsData.products}
		{loading}
		onEdit={handleEdit}
		onRefresh={() => fetchProducts(productsData.page)}
	/>

	<!-- Pagination -->
	<TablePagination
		page={productsData.page}
		perPage={productsData.perPage}
		total={productsData.total}
		totalPages={productsData.totalPages}
		onPageChange={(p) => fetchProducts(p)}
	/>
</div>
