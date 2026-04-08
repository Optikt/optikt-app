<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { ProductForm } from '$lib/components/products';

	let { data } = $props();
</script>

<svelte:head>
	<title>Crear Producto - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-slate-50/50 p-8">
	<!-- Header -->
	<div class="mb-8 w-full">
		<a
			href={resolve('/products')}
			class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-700"
		>
			<ArrowLeft class="h-4 w-4" />
			Volver a productos
		</a>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Crear Producto</h1>
		<p class="text-slate-500">Agrega un nuevo producto al inventario</p>
	</div>

	<!-- Form -->
	<ProductForm
		brands={data.brands}
		suppliers={data.suppliers}
		materials={data.materials}
		cancelHref="/products"
	/>
</div>
