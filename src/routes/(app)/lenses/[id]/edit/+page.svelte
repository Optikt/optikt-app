<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { LensCatalogForm } from '$lib/components/lenses';

	let { data } = $props();
</script>

<svelte:head>
	<title>Editar Lente - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-slate-50/50 p-8">
	<div class="mx-auto mb-8 max-w-4xl">
		<a
			href={resolve('/lenses')}
			class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-700"
		>
			<ArrowLeft class="h-4 w-4" />
			Volver al catálogo
		</a>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Editar Lente de Catálogo</h1>
		<p class="text-slate-500">{data.item.name}</p>
	</div>

	<LensCatalogForm
		item={data.item}
		existingRanges={data.ranges}
		materials={data.materials}
		suppliers={data.suppliers}
		cancelHref="/lenses"
	/>
</div>
