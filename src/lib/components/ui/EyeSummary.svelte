<script lang="ts">
	import type { LensEyeEntry } from '../sales/newSaleTypes';

	interface Props {
		eye: string;
		lensEntry: LensEyeEntry;
		textSize?: number;
	}

	let { eye, lensEntry, textSize = 12 }: Props = $props();

	function formatEyeSummary(entry: LensEyeEntry): { label: string; value: string }[] {
		const parts: { label: string; value: string }[] = [];
		if (entry.prescription.sphere != null)
			parts.push({ label: 'ESF', value: `${entry.prescription.sphere}` });
		if (entry.prescription.cylinder != null)
			parts.push({ label: 'CIL', value: `${entry.prescription.cylinder}` });
		if (entry.prescription.axis != null)
			parts.push({ label: 'EJE', value: `${entry.prescription.axis}°` });
		if (entry.prescription.addition != null)
			parts.push({ label: 'ADD', value: `+${entry.prescription.addition}` });
		if (entry.dp != null) parts.push({ label: 'DP', value: `${entry.dp}` });
		if (entry.np != null) parts.push({ label: 'NP', value: `${entry.np}` });
		return parts;
	}

	const segments = $derived(formatEyeSummary(lensEntry));
</script>

<p class="truncate font-mono text-wrap text-on-surface-variant" style="font-size: {textSize}px">
	<span class="font-bold"><span class="underline">{eye}</span>:</span>
	{#if segments.length > 0}
		{#each segments as seg, i}
			{#if i > 0}<span class="text-slate-500">&nbsp;/</span>{/if}
			<span class="font-semibold text-brand-navy">{seg.label}</span>&nbsp;{seg.value}
		{/each}
	{:else}
		<span class="text-slate-400 italic">--</span>
	{/if}
</p>
