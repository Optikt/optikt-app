<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	/** Estado vacío del listado de presupuestos (compartido escritorio/móvil). */
	interface Props {
		hasFilters: boolean;
		onClearFilters: () => void;
	}

	let { hasFilters, onClearFilters }: Props = $props();
</script>

{#snippet quoteIcon()}
	<FileText class="h-10 w-10" />
{/snippet}

<div class="flex flex-col items-center px-4 py-10">
	<EmptyState icon={quoteIcon} message="No se encontraron presupuestos" />
	{#if hasFilters}
		<button
			type="button"
			onclick={onClearFilters}
			class="mt-3 inline-flex h-9 items-center rounded-[var(--ds-radius-md)] bg-brand-navy px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-navy-dark"
		>
			Limpiar filtros
		</button>
	{/if}
</div>
