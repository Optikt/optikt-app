<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { NewQuoteForm } from '$lib/components/quotes';

	let { data } = $props();
</script>

<svelte:head>
	<title>Nuevo Presupuesto - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-slate-50/50 p-8">
	<!-- Header -->
	<div class="mb-8 w-full">
		<a
			href={resolve('/quotes')}
			class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-blue-600"
		>
			<ArrowLeft class="h-4 w-4" />
			Volver a presupuestos
		</a>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Nuevo Presupuesto</h1>
		<p class="mt-1 text-base text-slate-500">Crea un nuevo presupuesto para un cliente</p>
	</div>

	<!-- Form -->
	<NewQuoteForm
		products={data.products}
		lensItems={data.lensItems}
		suppliers={data.suppliers}
		nextQuoteNumber={data.nextQuoteNumber}
	/>
</div>
