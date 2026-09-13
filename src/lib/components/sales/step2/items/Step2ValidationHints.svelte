<script lang="ts">
	interface Props {
		valid: boolean;
		reasons: string[];
	}

	let { valid, reasons }: Props = $props();
</script>

{#if !valid}
	{#if reasons.length > 0}
		<div class="rounded-lg bg-warning-container/60 px-4 py-2.5 text-on-warning-container sm:px-5">
			<p class="text-[10px] font-semibold tracking-[0.14em] uppercase">Para continuar</p>
			<ul class="mt-1.5 space-y-0.5 text-xs">
				{#each reasons as reason, index (index)}<li>{reason}</li>{/each}
			</ul>
		</div>
	{/if}
{/if}
