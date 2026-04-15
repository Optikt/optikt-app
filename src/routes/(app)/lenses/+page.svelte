<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { FlaskConical, LibraryBig, Plus, RotateCcw, Search } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { LensCatalogTable, LensMaterialsTab } from '$lib/components/lenses';
	import { getErrorMessage } from '$lib/utils';
	import { listLensCatalog } from '$lib/remote/lenses.remote';
	import {
		ALL_LENS_SOURCES,
		ALL_LENS_TYPES,
		getLensSourceLabel,
		getLensTypeLabel,
		LensCatalogSource,
		LensType
	} from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';

	type ActiveTab = 'catalog' | 'materials';

	let { data }: { data: PageData } = $props();
	let { materials, catalogItems, suppliers } = untrack(() => data);

	let activeTab = $state<ActiveTab>('catalog');
	let items = $state<LensCatalogItemWithRelations[]>(catalogItems);
	let catalogLoading = $state(false);
	let search = $state('');
	let sourceFilter = $state<LensCatalogSource | ''>('');
	let typeFilter = $state<LensType | ''>('');
	let supplierFilter = $state('');
	let materialFilter = $state('');
	let page = $state(1);

	const hasActiveFilters = $derived(
		search.trim().length > 0 ||
			sourceFilter !== '' ||
			typeFilter !== '' ||
			supplierFilter !== '' ||
			materialFilter !== ''
	);

	const catalogSummary = $derived.by(() => ({
		total: items.length,
		finished: items.filter((item) => item.source === LensCatalogSource.FINISHED).length,
		lab: items.filter((item) => item.source === LensCatalogSource.LAB).length
	}));

	const pageTitle = $derived(
		activeTab === 'catalog' ? 'Catálogo de Lentes' : 'Materiales de Lentes'
	);

	const pageEyebrow = $derived(activeTab === 'catalog' ? 'Curaduría óptica' : 'Biblioteca técnica');

	const pageDescription = $derived(
		activeTab === 'catalog'
			? 'Gestiona cristales terminados y de laboratorio con un listado técnico, claro y fácil de escanear para ventas y atención clínica.'
			: 'Administra los materiales ópticos que alimentan el catálogo de lentes, con sus códigos, descripciones e índices refractivos.'
	);

	async function fetchCatalog() {
		catalogLoading = true;
		try {
			items = await listLensCatalog({
				search: search.trim() || undefined,
				source: sourceFilter || undefined,
				type: typeFilter || undefined,
				supplierId: supplierFilter || undefined,
				materialId: materialFilter || undefined
			});
			page = 1;
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

	function clearFilters() {
		search = '';
		sourceFilter = '';
		typeFilter = '';
		supplierFilter = '';
		materialFilter = '';
		void fetchCatalog();
	}

	function handleCatalogPageChange(nextPage: number) {
		page = nextPage;
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
</script>

<svelte:head>
	<title>Lentes - Optikt</title>
</svelte:head>

<div class="space-y-6 p-6">
	<section class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_auto] xl:items-end">
		<div class="space-y-3">
			<p class="text-xs font-semibold tracking-[0.24em] text-brand-gold uppercase">{pageEyebrow}</p>
			<h1 class="font-heading text-3xl font-bold tracking-tight text-brand-navy sm:text-4xl">
				{pageTitle}
			</h1>
			<p class="max-w-3xl text-sm leading-7 text-on-surface-variant sm:text-base">
				{pageDescription}
			</p>

			{#if activeTab === 'catalog'}
				<div class="flex flex-wrap gap-2 pt-1">
					<div
						class="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
					>
						<LibraryBig class="h-3.5 w-3.5" />
						{catalogSummary.total} lentes
					</div>
					<div
						class="inline-flex items-center gap-2 rounded-full bg-info-container px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-info-container uppercase"
					>
						{catalogSummary.finished} terminados
					</div>
					<div
						class="inline-flex items-center gap-2 rounded-full bg-warning-container px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-warning-container uppercase"
					>
						<FlaskConical class="h-3.5 w-3.5" />
						{catalogSummary.lab} laboratorio
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-3 xl:items-end">
			<div class="inline-flex rounded-2xl bg-surface-container-high p-1 shadow-sm">
				<button
					type="button"
					onclick={() => (activeTab = 'catalog')}
					aria-pressed={activeTab === 'catalog'}
					class="rounded-xl px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors sm:px-5 {activeTab ===
					'catalog'
						? 'bg-brand-navy text-white'
						: 'text-on-surface-variant hover:bg-surface-container-lowest'}"
				>
					Catálogo
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'materials')}
					aria-pressed={activeTab === 'materials'}
					class="rounded-xl px-4 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-colors sm:px-5 {activeTab ===
					'materials'
						? 'bg-brand-navy text-white'
						: 'text-on-surface-variant hover:bg-surface-container-lowest'}"
				>
					Materiales
				</button>
			</div>

			{#if activeTab === 'catalog'}
				<button
					type="button"
					onclick={openCreateLens}
					class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-3 text-xs font-bold tracking-[0.2em] text-brand-navy uppercase shadow-sm transition-colors hover:bg-brand-gold-dark"
				>
					<Plus class="h-4 w-4" />
					Nuevo lente
				</button>
			{/if}
		</div>
	</section>

	{#if activeTab === 'catalog'}
		<section class="glass-card bg-surface-container-low p-4">
			<div
				class="grid gap-3 xl:grid-cols-[minmax(260px,1.2fr)_180px_180px_200px_200px_auto] xl:items-center"
			>
				<div class="relative">
					<Search class="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline" />
					<input
						id="lens-catalog-search"
						name="lens-catalog-search"
						type="search"
						bind:value={search}
						oninput={handleSearch}
						placeholder="Buscar por lente, proveedor o material..."
						class="w-full rounded-lg border-none bg-surface-container-high p-3 pl-11 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
					/>
				</div>

				<select
					id="lens-source-filter"
					name="lens-source-filter"
					bind:value={sourceFilter}
					onchange={handleFilterChange}
					class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
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
					class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				>
					<option value="">Tipo</option>
					{#each ALL_LENS_TYPES as type (type)}
						<option value={type}>{getLensTypeLabel(type)}</option>
					{/each}
				</select>

				<select
					id="lens-supplier-filter"
					name="lens-supplier-filter"
					bind:value={supplierFilter}
					onchange={handleFilterChange}
					class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				>
					<option value="">Proveedor</option>
					{#each suppliers as supplier (supplier.id)}
						<option value={supplier.id}>{supplier.name}</option>
					{/each}
				</select>

				<select
					id="lens-material-filter"
					name="lens-material-filter"
					bind:value={materialFilter}
					onchange={handleFilterChange}
					class="rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				>
					<option value="">Material</option>
					{#each materials as material (material.id)}
						<option value={material.id}>{material.name}</option>
					{/each}
				</select>

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

		<LensCatalogTable
			{items}
			{page}
			perPage={Math.max(items.length, 1)}
			total={items.length}
			totalPages={1}
			loading={catalogLoading}
			onRefresh={fetchCatalog}
			onPageChange={handleCatalogPageChange}
			onView={(item) => openLensDetail(item.id)}
			onEdit={(item) => openLensEdit(item.id)}
		/>
	{:else}
		<LensMaterialsTab initialMaterials={materials} />
	{/if}
</div>
