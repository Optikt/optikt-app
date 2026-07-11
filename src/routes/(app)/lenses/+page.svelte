<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Plus, RotateCcw, Search } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { LensCatalogTable, LensPropertiesTab } from '$lib/components/lenses';
	import { PageHeader, SelectInput } from '$lib/components/ui';
	import { parsePageParam, replaceUrlSearch, setQueryParam, getErrorMessage } from '$lib/utils';
	import { listLensCatalog } from '$lib/remote/lenses.remote';
	import {
		ALL_LENS_SOURCES,
		ALL_LENS_TYPES,
		getLensSourceLabel,
		getLensTypeLabel,
		isAdminRole,
		LensCatalogSource,
		LensType
	} from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';

	type ActiveTab = 'catalog' | 'properties';

	let { data }: { data: PageData } = $props();
	let {
		materials,
		catalogItems,
		suppliers,
		technologies,
		differentiators,
		allTechnologies,
		allDifferentiators
	} = untrack(() => data);
	const initialQuery = untrack(() => page.url.searchParams);
	const initialPage = parsePageParam(initialQuery.get('page'));
	const initialSearch = initialQuery.get('q') ?? '';
	const initialSource = initialQuery.get('source');
	const initialType = initialQuery.get('type');
	const initialSupplier = initialQuery.get('supplier') ?? '';
	const initialMaterial = initialQuery.get('material') ?? '';
	const initialTechnology = initialQuery.get('technology') ?? '';
	const initialDifferentiator = initialQuery.get('differentiator') ?? '';
	const CATALOG_PER_PAGE = 20;

	function parseSource(value: string | null): LensCatalogSource | '' {
		if (!value) return '';
		return ALL_LENS_SOURCES.includes(value as LensCatalogSource)
			? (value as LensCatalogSource)
			: '';
	}

	function parseType(value: string | null): LensType | '' {
		if (!value) return '';
		return ALL_LENS_TYPES.includes(value as LensType) ? (value as LensType) : '';
	}

	function clampPage(target: number, totalItems: number): number {
		const maxPage = Math.max(1, Math.ceil(totalItems / CATALOG_PER_PAGE));
		return Math.min(Math.max(target, 1), maxPage);
	}

	let activeTab = $state<ActiveTab>('catalog');
	let items = $state<LensCatalogItemWithRelations[]>(catalogItems);
	let catalogLoading = $state(false);
	let search = $state(initialSearch);
	let sourceFilter = $state<LensCatalogSource | ''>(parseSource(initialSource));
	let typeFilter = $state<LensType | ''>(parseType(initialType));
	let supplierFilter = $state(initialSupplier);
	let materialFilter = $state(initialMaterial);
	let technologyFilter = $state(initialTechnology);
	let differentiatorFilter = $state(initialDifferentiator);
	let showAdvancedFilters = $state(
		initialSource != null ||
			initialType != null ||
			initialSupplier.length > 0 ||
			initialMaterial.length > 0 ||
			initialTechnology.length > 0 ||
			initialDifferentiator.length > 0
	);
	let catalogPage = $state(clampPage(initialPage, catalogItems.length));
	const isAdmin = $derived(isAdminRole(data.user.role));

	const hasActiveFilters = $derived(
		search.trim().length > 0 ||
			sourceFilter !== '' ||
			typeFilter !== '' ||
			supplierFilter !== '' ||
			materialFilter !== '' ||
			technologyFilter !== '' ||
			differentiatorFilter !== ''
	);

	const totalCatalogPages = $derived(Math.max(1, Math.ceil(items.length / CATALOG_PER_PAGE)));
	const supplierOptions = $derived.by(() =>
		[...suppliers]
			.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
			.map((supplier) => ({ id: supplier.id, name: supplier.name }))
	);
	const technologyOptions = $derived(technologies);
	const differentiatorOptions = $derived(
		differentiators.map((differentiator) => ({ id: differentiator, name: differentiator }))
	);
	const pagedCatalogItems = $derived.by(() => {
		const start = (catalogPage - 1) * CATALOG_PER_PAGE;
		return items.slice(start, start + CATALOG_PER_PAGE);
	});

	const pageTitle = $derived(
		activeTab === 'catalog' ? 'Catálogo de Lentes' : 'Propiedades de Lentes'
	);

	function syncCatalogUrl(nextPage: number): void {
		replaceUrlSearch(page.url, (params) => {
			setQueryParam(params, 'q', search.trim());
			setQueryParam(params, 'source', sourceFilter || null);
			setQueryParam(params, 'type', typeFilter || null);
			setQueryParam(params, 'supplier', supplierFilter || null);
			setQueryParam(params, 'material', materialFilter || null);
			setQueryParam(params, 'technology', technologyFilter || null);
			setQueryParam(params, 'differentiator', differentiatorFilter || null);
			setQueryParam(params, 'page', nextPage > 1 ? nextPage : null);
		});
	}

	async function fetchCatalog() {
		syncCatalogUrl(1);
		catalogLoading = true;
		try {
			items = await listLensCatalog({
				search: search.trim() || undefined,
				source: sourceFilter || undefined,
				type: typeFilter || undefined,
				supplierId: supplierFilter || undefined,
				materialId: materialFilter || undefined,
				technologyId: technologyFilter || undefined
			});
			catalogPage = 1;
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error cargando catálogo de lentes'));
		} finally {
			catalogLoading = false;
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			void fetchCatalog();
		}, 250);
	}

	function handleFilterChange() {
		void fetchCatalog();
	}

	function handleSupplierFilterChange(_selected: { id: string; name: string } | null) {
		void fetchCatalog();
	}

	function handleTechnologyFilterChange(_selected: { id: string; name: string } | null) {
		void fetchCatalog();
	}

	function handleDifferentiatorFilterChange(_selected: { id: string; name: string } | null) {
		void fetchCatalog();
	}

	function clearFilters() {
		search = '';
		sourceFilter = '';
		typeFilter = '';
		supplierFilter = '';
		materialFilter = '';
		technologyFilter = '';
		differentiatorFilter = '';
		showAdvancedFilters = false;
		void fetchCatalog();
	}

	function toggleAdvancedFilters() {
		showAdvancedFilters = !showAdvancedFilters;
	}

	function handleCatalogPageChange(nextPage: number) {
		catalogPage = clampPage(nextPage, items.length);
		syncCatalogUrl(catalogPage);
	}

	function openCreateLens() {
		goto(resolve('/lenses/create'));
	}

	function openLensDetail(id: string) {
		goto(resolve(`/lenses/${id}`));
	}

	function openLensEdit(id: string) {
		goto(resolve(`/lenses/${id}/edit`));
	}

	function getViewHref(item: LensCatalogItemWithRelations): `/lenses/${string}` {
		return `/lenses/${item.id}`;
	}

	function getEditHref(item: LensCatalogItemWithRelations): `/lenses/${string}/edit` {
		return `/lenses/${item.id}/edit`;
	}
</script>

<svelte:head>
	<title>Lentes - Optikt</title>
</svelte:head>

<div class="space-y-5 p-4 sm:space-y-6 sm:p-6">
	<PageHeader title={pageTitle}>
		{#snippet actions()}
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
				{#if isAdmin && activeTab === 'catalog'}
					<button
						type="button"
						onclick={openCreateLens}
						class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-gold px-3 text-xs font-bold tracking-[0.2em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-brand-gold-dark sm:h-11 sm:w-auto sm:px-5"
					>
						<Plus class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
						<span class="hidden sm:inline">Nuevo lente</span>
						<span class="sm:hidden">Lente</span>
					</button>
				{/if}

				<div
					class="inline-flex w-full rounded-2xl bg-surface-container-high p-1 shadow-sm sm:w-auto"
				>
					<button
						type="button"
						onclick={() => (activeTab = 'catalog')}
						aria-pressed={activeTab === 'catalog'}
						class="flex-1 rounded-xl px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors sm:flex-none sm:px-5 {activeTab ===
						'catalog'
							? 'bg-brand-navy text-white'
							: 'text-on-surface-variant hover:bg-surface-container-lowest'}"
					>
						Catálogo
					</button>
					<button
						type="button"
						onclick={() => (activeTab = 'properties')}
						aria-pressed={activeTab === 'properties'}
						class="flex-1 rounded-xl px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors sm:flex-none sm:px-5 {activeTab ===
						'properties'
							? 'bg-brand-navy text-white'
							: 'text-on-surface-variant hover:bg-surface-container-lowest'}"
					>
						Propiedades
					</button>
				</div>
			</div>
		{/snippet}
	</PageHeader>

	{#if activeTab === 'catalog'}
		<section class="glass-card bg-surface-container-low p-2 sm:p-3">
			<div class="space-y-2">
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
					<div class="relative min-w-0 flex-1">
						<Search class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-outline" />
						<input
							id="lens-catalog-search"
							name="lens-catalog-search"
							type="search"
							bind:value={search}
							oninput={handleSearch}
							placeholder="Buscar por lente, material, tecnologia, proveedor o propiedades"
							class="h-10 w-full rounded-lg border-none bg-surface-container-high px-3 pl-9 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
						/>
					</div>

					<button
						type="button"
						onclick={toggleAdvancedFilters}
						class="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high px-3 text-xs font-semibold tracking-[0.12em] text-on-surface uppercase transition-colors hover:bg-surface-container-highest"
						aria-expanded={showAdvancedFilters}
					>
						Filtros avanzados
					</button>

					<button
						type="button"
						onclick={clearFilters}
						disabled={!hasActiveFilters}
						class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 {hasActiveFilters
							? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
							: 'bg-surface-container-high text-outline'}"
						aria-label="Limpiar filtros"
						title="Limpiar filtros"
					>
						<RotateCcw class="h-3.5 w-3.5" />
					</button>
				</div>

				{#if showAdvancedFilters}
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
						<select
							id="lens-source-filter"
							name="lens-source-filter"
							bind:value={sourceFilter}
							onchange={handleFilterChange}
							class="h-10 rounded-lg border-none bg-surface-container-high px-3 text-xs font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
						>
							<option value="">Origen</option>
							{#each ALL_LENS_SOURCES as source (source)}
								<option value={source}>{getLensSourceLabel(source)}</option>
							{/each}
						</select>

						<select
							id="lens-type-filter"
							name="lens-type-filter"
							bind:value={typeFilter}
							onchange={handleFilterChange}
							class="h-10 rounded-lg border-none bg-surface-container-high px-3 text-xs font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
						>
							<option value="">Tipo</option>
							{#each ALL_LENS_TYPES as type (type)}
								<option value={type}>{getLensTypeLabel(type)}</option>
							{/each}
						</select>

						<div>
							<SelectInput
								bind:value={supplierFilter}
								options={supplierOptions}
								placeholder="Proveedor"
								onChange={handleSupplierFilterChange}
								valueField="id"
								labelField="name"
							/>
						</div>

						<select
							id="lens-material-filter"
							name="lens-material-filter"
							bind:value={materialFilter}
							onchange={handleFilterChange}
							class="h-10 rounded-lg border-none bg-surface-container-high px-3 text-xs font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
						>
							<option value="">Material</option>
							{#each materials as material (material.id)}
								<option value={material.id}>{material.name}</option>
							{/each}
						</select>

						<div>
							<SelectInput
								bind:value={technologyFilter}
								options={technologyOptions}
								placeholder="Tecnologia"
								onChange={handleTechnologyFilterChange}
								valueField="id"
								labelField="name"
							/>
						</div>

						<div>
							<SelectInput
								bind:value={differentiatorFilter}
								options={differentiatorOptions}
								placeholder="Etiqueta"
								onChange={handleDifferentiatorFilterChange}
								valueField="id"
								labelField="name"
							/>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<LensCatalogTable
			items={pagedCatalogItems}
			page={catalogPage}
			perPage={CATALOG_PER_PAGE}
			total={items.length}
			totalPages={totalCatalogPages}
			loading={catalogLoading}
			onRefresh={fetchCatalog}
			onPageChange={handleCatalogPageChange}
			onView={(item) => openLensDetail(item.id)}
			onEdit={isAdmin ? (item) => openLensEdit(item.id) : undefined}
			{getViewHref}
			getEditHref={isAdmin ? getEditHref : undefined}
			canManage={isAdmin}
		/>
	{:else}
		<LensPropertiesTab
			initialMaterials={materials}
			initialTechnologies={allTechnologies}
			initialDifferentiators={allDifferentiators}
			initialSuppliers={suppliers}
			canManage={isAdmin}
		/>
	{/if}
</div>
