<script lang="ts">
	import { Button, Select } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SearchInput, TablePagination, ConfirmModal } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { listProducts, deleteProductById } from '$lib/remote/products.remote';
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
	let typeFilter = $state<ProductType | ''>('');
	let brandFilter = $state('');
	let supplierFilter = $state('');

	// Delete modal state
	let showDeleteModal = $state(false);
	let deleteProduct = $state<ProductWithRelations | null>(null);
	let deleteLoading = $state(false);

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
				supplierId: supplierFilter || undefined
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

	// Navigate to product detail
	function handleRowClick(product: ProductWithRelations) {
		goto(resolve(`/(app)/products/[id]`, { id: product.id }));
	}

	// Navigate to edit page
	function handleEdit(product: ProductWithRelations) {
		goto(resolve(`/(app)/products/[id]/update`, { id: product.id }));
	}

	// Open delete confirmation
	function openDelete(product: ProductWithRelations) {
		deleteProduct = product;
		showDeleteModal = true;
	}

	async function confirmDelete() {
		if (!deleteProduct) return;

		deleteLoading = true;
		try {
			await deleteProductById({ id: deleteProduct.id });
			toast.success('Producto eliminado correctamente');
			showDeleteModal = false;
			deleteProduct = null;
			fetchProducts(productsData.page);
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error eliminando producto'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Productos - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Productos</h1>
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
			<option value="">Todos los tipos</option>
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
	</div>

	<!-- Table -->
	<ProductsTable
		products={productsData.products}
		{loading}
		onView={handleRowClick}
		onEdit={handleEdit}
		onDelete={openDelete}
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

<!-- Delete Confirmation Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Producto"
	message="¿Estás seguro de que deseas eliminar este producto? Esta acción puede ser revertida."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={confirmDelete}
	onCancel={() => (showDeleteModal = false)}
/>
