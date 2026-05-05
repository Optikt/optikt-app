<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { ProductForm } from '$lib/components/products';
	import { PageHeader } from '$lib/components/ui';

	let { data } = $props();
	const { product, brands, suppliers, materials, brandSupplierMap, supplierBrandMap } = untrack(
		() => data
	);
	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Editar {product.name} - Optikt</title>
</svelte:head>
<div class="mx-auto px-4 py-6 sm:px-6 lg:px-8">
	<PageHeader
		title="Editar Producto"
		subtitle={product.sku}
		backLabel="Volver al producto"
		backHref={`/products/${product.id}`}
	>
		{#snippet actions()}
			<button
				type="button"
				onclick={() => goto(resolve(`/products/${product.id}` as `/products/${string}`))}
				class="rounded-lg px-5 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				Cancelar
			</button>
			<button
				type="submit"
				form="product-update-form"
				disabled={isSubmitting}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if isSubmitting}
					<span
						class="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
					></span>
				{/if}
				Guardar cambios
			</button>
		{/snippet}
	</PageHeader>

	<div class="mt-6">
		<ProductForm
			{product}
			{brands}
			{suppliers}
			{materials}
			{brandSupplierMap}
			{supplierBrandMap}
			cancelHref={`/products/${product.id}`}
			formId="product-update-form"
			showActions={false}
			bind:isSubmitting
		/>
	</div>
</div>
