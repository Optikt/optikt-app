<script lang="ts">
	import { Info } from '@lucide/svelte';
	import TriggerTooltip from './TriggerTooltip.svelte';

	interface Props {
		text: string;
		side?: 'top' | 'right' | 'bottom' | 'left';
		class?: string;
	}

	let { text, side = 'top', class: className = '' }: Props = $props();
</script>

{#snippet infoTrigger({ props }: { props: Record<string, unknown> })}
	<button
		{...props}
		type="button"
		class={`inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-outline transition-colors hover:text-brand-blue focus:outline-none ${className}`}
		aria-label="Más información"
	>
		<Info size={12} />
	</button>
{/snippet}

<TriggerTooltip {text} {side} contentClass="max-w-64" trigger={infoTrigger} />
