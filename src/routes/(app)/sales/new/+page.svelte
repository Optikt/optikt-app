<script lang="ts">
	import { resolve } from '$app/paths';
	import { NewSaleForm } from '$lib/components/sales';

	let { data } = $props();
</script>

<svelte:head>
	<title>Nueva Venta - Optikt</title>
</svelte:head>

<div class="bg-slate px-4 py-3 sm:px-6 lg:px-8">
	<div class="w-full">
		<NewSaleForm
			products={data.products}
			lensItems={data.lensItems}
			suppliers={data.suppliers}
			nextOrderNumber={data.nextOrderNumber}
			defaultTaxRate={data.defaultTaxRate}
		>
			{#snippet breadcrumbs()}
				<p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
					<a href={resolve('/sales')} class="transition-colors hover:text-brand-blue">Ventas</a>
					<span class="mx-2 text-outline">›</span>
					<span class="text-brand-navy">Nueva venta</span>
				</p>
			{/snippet}
		</NewSaleForm>
	</div>
</div>
