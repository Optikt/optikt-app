<script lang="ts">
	import type { TrafficState } from '$lib/shared/inventoryCount';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface Props {
		state: TrafficState;
		title: string;
		hint: string;
	}

	let { state, title, hint }: Props = $props();

	const dotClasses: Record<TrafficState, string> = {
		ok: 'bg-success',
		soon: 'bg-warning',
		over: 'bg-error',
		none: 'border-[1.5px] border-outline'
	};
</script>

<TriggerTooltip {title} text={hint}>
	{#snippet trigger({ props })}
		<span
			{...props}
			class={`inline-block h-3 w-3 rounded-full ${dotClasses[state]}`}
			aria-label={title}
		></span>
	{/snippet}
</TriggerTooltip>
