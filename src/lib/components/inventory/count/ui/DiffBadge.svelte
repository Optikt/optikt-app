<script lang="ts">
	import { ArrowDown, ArrowUp } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface Props {
		/** Diferencia final (recuento ?? conteo − sistema); null = sin contar. */
		diff: number | null;
		/** 'low' = bajo umbral (ámbar) · 'high' = sobre umbral (rojo). */
		gravity: 'pending' | 'match' | 'low' | 'high';
		/** Texto completo del estado para el tooltip (título). */
		stateTitle: string;
		systemStock?: number;
		counted?: number | null;
		textual?: boolean;
	}

	let { diff, gravity, stateTitle, systemStock, counted, textual = false }: Props = $props();
</script>

{#if diff == null || diff === 0}
	<span>—</span>
{:else}
	<TriggerTooltip
		title={stateTitle}
		text={`El sistema dice ${systemStock ?? '—'}; contaste ${counted ?? '—'}.`}
	>
		{#snippet trigger({ props })}
			<span
				{...props}
				class={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${
					gravity === 'high'
						? 'bg-error-container text-on-error-container'
						: 'bg-warning-container text-on-warning-container'
				}`}
			>
				{#if diff > 0}
					<ArrowUp class="h-3 w-3" aria-hidden="true" />
				{:else}
					<ArrowDown class="h-3 w-3" aria-hidden="true" />
				{/if}
				<span>{diff > 0 ? '+' : '−'}{Math.abs(diff)}</span>
				{#if textual}
					<span class="hidden lg:inline">{diff > 0 ? 'sobra' : 'falta'}</span>
				{/if}
			</span>
		{/snippet}
	</TriggerTooltip>
{/if}
