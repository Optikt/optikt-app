<script lang="ts">
	import { X } from '@lucide/svelte';
	import ScrollableRow from '$lib/components/ui/ScrollableRow.svelte';

	interface Props {
		chips: { id: string; label: string; onRemove: () => void }[];
		onClear: () => void;
		/** Móvil: fila horizontal desplazable con ✕ táctil (28 px). */
		scroll?: boolean;
	}

	let { chips, onClear, scroll = false }: Props = $props();
</script>

{#snippet chipsRow()}
	{#each chips as chip (chip.id)}
		<span
			role="listitem"
			class="inline-flex shrink-0 items-center gap-1 rounded-[var(--ds-radius-sm)] bg-info-container py-0.5 pr-1 pl-2.5 text-xs font-semibold text-on-info-container"
		>
			{chip.label}
			<button
				type="button"
				onclick={chip.onRemove}
				aria-label="Quitar filtro {chip.label}"
				class="grid h-7 w-7 place-items-center rounded-[var(--ds-radius-sm)] transition-colors hover:bg-black/10"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</span>
	{/each}

	<button
		type="button"
		onclick={onClear}
		class="ml-1 shrink-0 text-xs font-semibold text-on-info-container underline underline-offset-2 transition-opacity hover:opacity-70"
	>
		Limpiar ({chips.length})
	</button>
{/snippet}

{#if chips.length > 0}
	{#if scroll}
		<ScrollableRow class="gap-1.5" role="list" ariaLabel="Filtros activos">
			{@render chipsRow()}
		</ScrollableRow>
	{:else}
		<div class="flex flex-wrap items-center gap-1.5" role="list" aria-label="Filtros activos">
			{@render chipsRow()}
		</div>
	{/if}
{/if}
