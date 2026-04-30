<script lang="ts">
	import { CircleX, Package, Plus, RotateCcw, Search, TriangleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { PageHeader } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import {
		getProductInventoryStats,
		listProducts,
		type ProductInventoryStats
	} from '$lib/remote/products.remote';
	import { ProductsTable } from '$lib/components/products';
	import {
		ALL_PRODUCT_STOCK_FILTERS,
		ALL_PRODUCT_TYPES,
		PRODUCT_STOCK_FILTER_LABELS,
		PRODUCT_TYPE_LABELS,
		isAdminRole,
		type ProductStockFilter,
		type ProductType
	} from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { PaginatedResult } from '$lib/types';
	import { untrack } from 'svelte';

	let { data } = $props();
	let { initialProducts, totalCount, stats: initialStats, brands, suppliers } = untrack(() => data);

	let productsData = $state<PaginatedResult<ProductWithRelations>>({
		items: initialProducts as ProductWithRelations[],
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let stats = $state<ProductInventoryStats>(initialStats);
	let loading = $state(false);
	const isAdmin = $derived(isAdminRole(data.user.role));

	let search = $state('');
	let typeFilter = $state<ProductType | ''>('');
	let stockFilter = $state<ProductStockFilter | ''>('');
	let brandFilter = $state('');
	let supplierFilter = $state('');
	let includeDeleted = $state(false);

	const hasActiveFilters = $derived(
		search.trim().length > 0 ||
			typeFilter !== '' ||
			stockFilter !== '' ||
			brandFilter !== '' ||
			supplierFilter !== '' ||
			includeDeleted
	);

	async function fetchProducts(page = 1) {
		loading = true;
		try {
			productsData = await listProducts({
				page,
				perPage: 10,
				search: search || undefined,
				type: typeFilter || undefined,
				stockStatus: stockFilter || undefined,
				brandId: brandFilter || undefined,
				supplierId: supplierFilter || undefined,
				includeDeleted
			}).run();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando productos'));
		} finally {
			loading = false;
		}
	}

	async function refreshStats() {
		try {
			stats = await getProductInventoryStats({}).run();
		} catch (e) {
			console.error(e);
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchProducts(1), 300);
	}

	function handleFilterChange() {
		fetchProducts(1);
	}

	function clearFilters() {
		search = '';
		typeFilter = '';
		stockFilter = '';
		brandFilter = '';
		supplierFilter = '';
		includeDeleted = false;
		fetchProducts(1);
	}

	function toggleDeleted() {
		includeDeleted = !includeDeleted;
		fetchProducts(1);
	}

	function handleView(product: ProductWithRelations) {
		goto(resolve(`/products/${product.id}`));
	}

	function handleEdit(product: ProductWithRelations) {
		goto(resolve(`/products/${product.id}/update`));
	}
</script>

<svelte:head>
	<title>Inventario de Productos - Optikt</title>
</svelte:head>

<div class="space-y-6 p-6">
	<PageHeader title="Productos" subtitle="Inventario">
		{#snippet actions()}
			{#if isAdmin}
				<button
					type="button"
					onclick={() => goto(resolve('/products/create'))}
					class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md"
				>
					<Plus class="h-4 w-4" />
					NUEVO PRODUCTO
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
		<section class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-highest text-brand-navy"
				>
					<Package class="h-5 w-5" />
				</div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
					Total de productos
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">
					{stats.total.toLocaleString('es-VE')}
				</p>
			</div>
		</section>

		<section class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
				>
					<TriangleAlert class="h-5 w-5" />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-warning-container uppercase">
					Stock bajo
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">
					{stats.lowStock.toLocaleString('es-VE')}
				</p>
			</div>
		</section>

		<section class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-error-container text-on-error-container"
				>
					<CircleX class="h-5 w-5" />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-error-container uppercase">
					Sin stock
				</p>
				<p class="font-heading text-3xl font-bold text-error">
					{stats.outOfStock.toLocaleString('es-VE')}
				</p>
			</div>
		</section>
	</div>

	<section class="glass-card bg-surface-container-low p-4">
		<div
			class="grid gap-3 xl:grid-cols-[minmax(240px,0.9fr)_180px_180px_180px_180px_auto_auto] xl:items-center"
		>
			<div class="relative">
				<Search class="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline" />
				<input
					id="products-search"
					name="products-search"
					type="search"
					bind:value={search}
					oninput={handleSearch}
					placeholder="Buscar por nombre, codigo o SKU..."
					class="w-full rounded-lg border-none bg-surface-container-high p-3 pl-11 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				/>
			</div>

			<select
				id="products-type-filter"
				name="products-type-filter"
				bind:value={typeFilter}
				onchange={handleFilterChange}
				class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			>
				<option value="">Tipo de producto</option>
				{#each ALL_PRODUCT_TYPES as type (type)}
					<option value={type}>{PRODUCT_TYPE_LABELS[type]}</option>
				{/each}
			</select>

			<select
				id="products-stock-filter"
				name="products-stock-filter"
				bind:value={stockFilter}
				onchange={handleFilterChange}
				class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			>
				<option value="">Estado de stock</option>
				{#each ALL_PRODUCT_STOCK_FILTERS as filter (filter)}
					<option value={filter}>{PRODUCT_STOCK_FILTER_LABELS[filter]}</option>
				{/each}
			</select>

			<select
				id="products-brand-filter"
				name="products-brand-filter"
				bind:value={brandFilter}
				onchange={handleFilterChange}
				class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			>
				<option value="">Marca</option>
				{#each brands as brand (brand.id)}
					<option value={brand.id}>{brand.name}</option>
				{/each}
			</select>

			<select
				id="products-supplier-filter"
				name="products-supplier-filter"
				bind:value={supplierFilter}
				onchange={handleFilterChange}
				class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			>
				<option value="">Proveedor</option>
				{#each suppliers as supplier (supplier.id)}
					<option value={supplier.id}>{supplier.name}</option>
				{/each}
			</select>

			<div class="flex items-center justify-end gap-3 xl:justify-self-end">
				<span class="text-sm font-medium whitespace-nowrap text-on-surface-variant">
					Mostrar eliminados
				</span>
				<button
					type="button"
					role="switch"
					aria-checked={includeDeleted}
					aria-label="Mostrar productos eliminados"
					onclick={toggleDeleted}
					class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors {includeDeleted
						? 'bg-brand-navy'
						: 'bg-surface-container-highest'}"
				>
					<span
						class="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform {includeDeleted
							? 'translate-x-6'
							: 'translate-x-1'}"
					></span>
				</button>
			</div>

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

	<ProductsTable
		products={productsData.items}
		page={productsData.page}
		perPage={productsData.perPage}
		total={productsData.total}
		totalPages={productsData.totalPages}
		{loading}
		onView={handleView}
		onEdit={isAdmin ? handleEdit : undefined}
		canManage={isAdmin}
		onRefresh={() => {
			fetchProducts(productsData.page);
			refreshStats();
		}}
		onPageChange={(page) => fetchProducts(page)}
	/>
</div>
