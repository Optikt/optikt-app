<script lang="ts">
	import { ReceiptText } from '@lucide/svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	/**
	 * Estado vacío del listado de ventas — compartido entre las plantillas
	 * de escritorio y móvil (no duplicar).
	 */
	interface Props {
		/** Total global de ventas: si es 0, el mensaje invita a la primera venta. */
		totalSales: number;
		hasFilters: boolean;
		onClearFilters: () => void;
	}

	let { totalSales, hasFilters, onClearFilters }: Props = $props();
</script>

{#snippet receiptIcon()}
	<ReceiptText class="h-10 w-10" />
{/snippet}

<div class="flex flex-col items-center px-4 py-10">
	<EmptyState
		icon={receiptIcon}
		message={totalSales === 0 ? 'Registra una venta para comenzar' : 'No se encontraron ventas'}
	/>
	{#if totalSales > 0}
		<p class="-mt-2 text-center text-[13px] text-on-surface-variant">
			Prueba con otros filtros o límpialos.
		</p>
	{/if}
	{#if hasFilters}
		<button
			type="button"
			onclick={onClearFilters}
			class="mt-3 inline-flex h-11 items-center rounded-[var(--ds-radius-md)] bg-brand-navy px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-navy-dark"
		>
			Limpiar filtros
		</button>
	{/if}
</div>
