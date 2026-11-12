<script lang="ts">
	import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';

	interface Props {
		text: string;
		tooltip?: string;
		class?: string;
	}

	let { text, tooltip, class: className = '' }: Props = $props();
</script>

<span class={`inline-flex items-center gap-1 ${className}`}>
	<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">{text}</span>
	{#if tooltip}
		<InfoTooltip text={tooltip} />
	{/if}
</span>
