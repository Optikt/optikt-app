<script lang="ts">
	import { resolve } from '$app/paths';
	import { NewQuoteForm } from '$lib/components/quotes';

	let { data } = $props();
</script>

<svelte:head>
	<title>Nuevo Presupuesto - Optikt</title>
</svelte:head>

<div class="bg-slate px-4 pt-3 sm:px-6 lg:px-8">
	<div class="w-full">
		<div class="mb-2 space-y-3">
			<p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
				<a href={resolve('/quotes')} class="transition-colors hover:text-brand-blue">Presupuestos</a
				>
				<span class="mx-2 text-outline">›</span>
				<span class="text-brand-navy">Nuevo presupuesto</span>
			</p>
		</div>

		<NewQuoteForm
			products={data.products}
			lensItems={data.lensItems}
			suppliers={data.suppliers}
			nextQuoteNumber={data.nextQuoteNumber}
			defaultTaxRate={data.defaultTaxRate}
		/>
	</div>
</div>
