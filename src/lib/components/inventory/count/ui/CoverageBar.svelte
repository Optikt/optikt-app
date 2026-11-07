<script lang="ts">
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface Segment {
		key: 'ok' | 'soon' | 'over' | 'none';
		/** Cantidad de ítems/porción del segmento. */
		value: number;
		/** Título del segmento (tooltip y leyenda). */
		title: string;
		hint: string;
	}

	interface Props {
		segments: Segment[];
		/** Alto de la barra en px (12 default, 8 para la tabla). */
		height?: number;
	}

	let { segments, height = 12 }: Props = $props();

	const fills: Record<Segment['key'], string> = {
		ok: 'bg-success',
		soon: 'bg-warning',
		over: 'bg-error',
		none: 'bg-outline-variant'
	};
</script>

<div
	class="flex gap-0.5 overflow-hidden rounded-md bg-surface-container"
	style={`height:${height}px`}
>
	{#each segments as segment (segment.key)}
		<TriggerTooltip title={segment.title} text={segment.hint}>
			{#snippet trigger({ props })}
				<div
					{...props}
					class={`${fills[segment.key]}`}
					style={`flex:${Math.max(segment.value, 0)};transition:flex 300ms`}
				></div>
			{/snippet}
		</TriggerTooltip>
	{/each}
</div>
