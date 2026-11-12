<script lang="ts">
	import { X } from '@lucide/svelte';

	interface Props {
		chips: { id: string; label: string; onRemove: () => void }[];
		onClear: () => void;
	}

	let { chips, onClear }: Props = $props();
</script>

{#if chips.length > 0}
	<div class="flex flex-wrap items-center gap-1.5" role="list" aria-label="Filtros activos">
		{#each chips as chip (chip.id)}
			<span
				role="listitem"
				class="inline-flex items-center gap-1 rounded-[var(--ds-radius-sm)] bg-info-container py-0.5 pr-1 pl-2.5 text-xs font-semibold text-on-info-container"
			>
				{chip.label}
				<button
					type="button"
					onclick={chip.onRemove}
					aria-label="Quitar filtro {chip.label}"
					class="grid h-5 w-5 place-items-center rounded-[var(--ds-radius-sm)] transition-colors hover:bg-black/10"
				>
					<X class="h-3 w-3" />
				</button>
			</span>
		{/each}

		<button
			type="button"
			onclick={onClear}
			class="ml-1 text-xs font-semibold text-on-info-container underline underline-offset-2 transition-opacity hover:opacity-70"
		>
			Limpiar ({chips.length})
		</button>
	</div>
{/if}
