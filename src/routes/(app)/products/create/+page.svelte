<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ProductForm } from '$lib/components/products';
	import { PageHeader } from '$lib/components/ui';

	let { data } = $props();
	const { brands, suppliers, materials, brandSupplierMap, supplierBrandMap } = untrack(() => data);
	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Crear Producto - Optikt</title>
</svelte:head>
<div class="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-8">
	<PageHeader
		title="Nuevo Producto Optico"
		subtitle="Catalogo de inventario"
		backLabel="Volver a productos"
		backHref="/products"
	>
		{#snippet actions()}
			<button
				type="button"
				onclick={() => goto(resolve('/products'))}
				class="rounded-lg px-5 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				Cancelar
			</button>
			<button
				type="submit"
				form="product-create-form"
				disabled={isSubmitting}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if isSubmitting}
					<span
						class="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
					></span>
				{/if}
				Crear producto
			</button>
		{/snippet}
	</PageHeader>

	<div class="mt-6">
		<ProductForm
			{brands}
			{suppliers}
			{materials}
			{brandSupplierMap}
			{supplierBrandMap}
			cancelHref="/products"
			formId="product-create-form"
			showActions={false}
			bind:isSubmitting
		/>
	</div>
</div>
