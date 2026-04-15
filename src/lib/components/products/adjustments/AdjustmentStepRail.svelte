<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { AdjustmentStep } from './helpers';

	interface Props {
		steps: AdjustmentStep[];
	}

	let { steps }: Props = $props();
</script>

<div class="relative space-y-7 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-surface-container-high">
	{#each steps as step (step.id)}
		<div class="relative flex items-center gap-5">
			<div
				class={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step.status === 'current' ? 'bg-brand-navy text-white shadow-[0_10px_24px_-16px_rgba(21,35,70,0.8)]' : step.status === 'complete' ? 'bg-info-container text-on-info-container' : 'bg-surface-container text-outline'}`}
			>
				{#if step.status === 'complete'}
					<Check class="h-4 w-4" />
				{:else}
					{step.id}
				{/if}
			</div>

			<div>
				<p
					class={`text-[0.68rem] font-bold tracking-[0.18em] uppercase ${step.status === 'upcoming' ? 'text-outline' : 'text-brand-navy'}`}
				>
					{step.title}
				</p>
				<p class={`text-sm ${step.status === 'upcoming' ? 'text-outline' : 'text-on-surface-variant'}`}>
					{step.description}
				</p>
			</div>
		</div>
	{/each}
</div>