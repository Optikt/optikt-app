<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { LensCatalogForm } from '$lib/components/lenses';
	import { PageHeader } from '$lib/components/ui';

	let { data } = $props();
	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Registrar Nuevo Lente - Optikt</title>
</svelte:head>
<div class="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-8">
	<PageHeader
		title="Registrar Nuevo Lente"
		subtitle="Catalogo de lentes"
		backLabel="Volver al catalogo"
		backHref="/lenses"
	>
		{#snippet actions()}
			<button
				type="button"
				onclick={() => goto(resolve('/lenses'))}
				class="rounded-lg px-5 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				Descartar
			</button>
			<button
				type="submit"
				form="lens-create-form"
				disabled={isSubmitting}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if isSubmitting}
					<span
						class="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
					></span>
				{/if}
				Guardar registro
			</button>
		{/snippet}
	</PageHeader>

	<div class="mt-6">
		<LensCatalogForm
			materials={data.materials}
			suppliers={data.suppliers}
			cancelHref="/lenses"
			formId="lens-create-form"
			showActions={false}
			bind:isSubmitting
		/>
	</div>
</div>
