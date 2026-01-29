<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { ProductForm } from '$lib/components/products';
	import { resolve } from '$app/paths';

	let { data } = $props();
	const { product, brands, suppliers } = untrack(() => data);
</script>

<svelte:head>
	<title>Editar {product.name} - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-slate-50/50 p-8">
	<!-- Header -->
	<div class="mx-auto mb-8 max-w-4xl">
		<a
			href={resolve(`/products/${product.id}`)}
			class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-700"
		>
			<ArrowLeft class="h-4 w-4" />
			Volver al producto
		</a>
		<h1 class="text-3xl font-bold tracking-tight text-slate-900">Editar Producto</h1>
		<p class="text-slate-500">{product.name} ({product.sku})</p>
	</div>

	<!-- Form - uses parent data -->
	<ProductForm {product} {brands} {suppliers} cancelHref={`/products/${product.id}`} />
</div>
