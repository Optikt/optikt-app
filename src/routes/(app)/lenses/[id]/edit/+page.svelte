<script lang="ts">
	import { LensCatalogForm } from '$lib/components/lenses';
	import { PageHeader } from '$lib/components/ui';

	let { data } = $props();
</script>

<svelte:head>
	<title>Editar Lente - Optikt</title>
</svelte:head>

<div class="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-8">
	<PageHeader
		title="Editar Lente de Catálogo"
		subtitle={data.item.name}
		backLabel="Volver al catálogo"
		backHref="/lenses"
	/>

	<LensCatalogForm
		item={data.item}
		existingRanges={data.ranges}
		materials={data.materials}
		suppliers={data.suppliers}
		differentiators={data.differentiators}
		supplierTechnologies={data.supplierTechnologies}
		technologyIsGlobal={data.technologyIsGlobal}
		cancelHref="/lenses"
	/>
</div>
