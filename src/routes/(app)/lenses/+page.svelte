<script lang="ts">
	import { Tabs, TabItem, Select, Button } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { SearchInput } from '$lib/components/ui';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils';
	import { LensMaterialsTab, LensTreatmentsTab, LensCatalogTable } from '$lib/components/lenses';
	import { listLensCatalog } from '$lib/remote/lenses.remote';
	import {
		LensType,
		LensCatalogSource,
		LENS_SOURCE_LABELS,
		ALL_LENS_TYPES,
		getLensTypeLabel
	} from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';

	let { data }: { data: PageData } = $props();
	let { materials, treatments, catalogItems, suppliers } = untrack(() => data);

	// Catalog state
	let items = $state<LensCatalogItemWithRelations[]>(catalogItems);
	let catalogLoading = $state(false);
	let search = $state('');
	let sourceFilter = $state<LensCatalogSource>();
	let typeFilter = $state<LensType>();
	let supplierFilter = $state<string>();

	// Fetch catalog items
	async function fetchCatalog() {
		catalogLoading = true;
		try {
			items = await listLensCatalog({
				source: sourceFilter || undefined,
				type: typeFilter || undefined,
				supplierId: supplierFilter || undefined
			});
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando catálogo'));
		} finally {
			catalogLoading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchCatalog(), 300);
	}

	function handleFilterChange() {
		fetchCatalog();
	}
</script>

<svelte:head>
	<title>Lentes - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Catálogo de Lentes</h1>
			<p class="text-slate-500">Cristales terminados y de laboratorio, materiales y tratamientos</p>
		</div>
		<Button color="blue" href={resolve('/lenses/create')}>
			<Plus class="mr-1.5 h-4 w-4" />
			Agregar Lente
		</Button>
	</div>

	<!-- Tabs -->
	<Tabs style="underline" classes={{ content: 'mt-4' }}>
		<TabItem open title="Catálogo">
			<!-- Filters -->
			<div
				class="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
			>
				<SearchInput
					bind:value={search}
					placeholder="Buscar por nombre, marca, tecnología, proveedor..."
					oninput={handleSearch}
					class="min-w-64 flex-1"
				/>
				<Select bind:value={sourceFilter} onchange={handleFilterChange} class="w-44">
					<option value={undefined}>Todos los orígenes</option>
					<option value={LensCatalogSource.FINISHED}>{LENS_SOURCE_LABELS.FINISHED}</option>
					<option value={LensCatalogSource.LAB}>{LENS_SOURCE_LABELS.LAB}</option>
				</Select>
				<Select bind:value={typeFilter} onchange={handleFilterChange} class="w-44">
					<option value={undefined}>Todos los tipos</option>
					{#each ALL_LENS_TYPES as type (type)}
						<option value={type}>{getLensTypeLabel(type)}</option>
					{/each}
				</Select>
				<Select bind:value={supplierFilter} onchange={handleFilterChange} class="w-48">
					<option value={undefined}>Todos los proveedores</option>
					{#each suppliers as s (s.id)}
						<option value={s.id}>{s.name}</option>
					{/each}
				</Select>
			</div>

			<LensCatalogTable {items} loading={catalogLoading} onRefresh={fetchCatalog} />
		</TabItem>

		<TabItem title="Materiales">
			<LensMaterialsTab initialMaterials={materials} />
		</TabItem>

		<TabItem title="Tratamientos">
			<LensTreatmentsTab initialTreatments={treatments} {suppliers} />
		</TabItem>
	</Tabs>
</div>
