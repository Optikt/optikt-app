<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { NewSaleForm } from '$lib/components/sales';

	let { data } = $props();
</script>

<svelte:head>
	<title>Nueva Venta - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-slate-50/50 p-8">
	<!-- Header -->
	<div class="mx-auto mb-8 max-w-5xl">
		<a
			href={resolve('/sales')}
			class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-blue-600"
		>
			<ArrowLeft class="h-4 w-4" />
			Volver a ventas
		</a>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Nueva Venta</h1>
		<p class="mt-1 text-base text-slate-500">Registra una nueva venta en el sistema</p>
	</div>

	<!-- Form -->
	<NewSaleForm
		products={data.products}
		lensItems={data.lensItems}
		nextOrderNumber={data.nextOrderNumber}
	/>
</div>
