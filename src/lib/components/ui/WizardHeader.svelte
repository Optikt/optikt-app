<script lang="ts">
	import { Hash } from '@lucide/svelte';
	import { Check } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import PageHeader from './PageHeader.svelte';

	interface WizardStepMeta {
		num: number;
		label: string;
	}

	interface Props {
		title?: string;
		subtitle?: string;
		steps: WizardStepMeta[];
		currentStep: number;
		canNavigateToStep: (step: number) => boolean;
		onStepSelect: (step: number) => void;
		orderNumber?: string;
		orderDate?: string;
		breadcrumbs?: Snippet;
	}

	let {
		title = '',
		subtitle,
		steps,
		currentStep,
		canNavigateToStep,
		onStepSelect,
		orderNumber,
		orderDate = $bindable(),
		breadcrumbs
	}: Props = $props();

	function stepBadgeClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const base =
			'flex h-8 w-8 items-center justify-center rounded-lg font-mono text-sm font-bold transition-all duration-200';
		if (isActive) return `${base} bg-brand-navy text-white`;
		if (isComplete) return `${base} bg-brand-gold text-brand-navy`;
		return `${base} bg-surface-container-high text-outline group-hover:bg-surface-container-highest group-hover:text-on-surface-variant`;
	}

	function stepLabelClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const base = 'text-[10px] font-semibold tracking-[0.14em] uppercase whitespace-nowrap';
		if (isActive || isComplete) return `${base} text-brand-navy`;
		return `${base} text-slate-400 group-hover:text-on-surface-variant`;
	}
</script>

<PageHeader {title} {subtitle}>
	{#snippet actions()}
		<div class="flex items-center justify-between gap-3 lg:gap-4">
			{#if breadcrumbs}
				{@render breadcrumbs()}
			{/if}
			<div class="hidden items-center gap-2 text-xs lg:flex">
				{#if orderNumber}
					<div
						class="flex items-center gap-1.5 rounded-lg bg-surface-container-high px-2.5 py-1 text-brand-blue"
					>
						<Hash class="h-3.5 w-3.5" />
						<span class="font-mono font-semibold">{orderNumber}</span>
					</div>
				{/if}
				{#if orderDate}
					<input
						type="date"
						bind:value={orderDate}
						class="cursor-pointer rounded-lg border border-outline-variant/30 bg-surface-container px-2.5 py-1 text-xs text-on-surface hover:border-brand-blue hover:bg-surface-container-high focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
					/>
				{/if}
			</div>
			<nav aria-label={title}>
				<div class="flex min-w-max items-center gap-1.5 sm:gap-2">
					{#each steps as step (step.num)}
						<button
							type="button"
							onclick={() => {
								if (canNavigateToStep(step.num)) onStepSelect(step.num);
							}}
							disabled={!canNavigateToStep(step.num)}
							class="group flex items-center gap-2 text-center transition-colors {canNavigateToStep(
								step.num
							)
								? 'cursor-pointer'
								: 'cursor-not-allowed'}"
						>
							<span class={stepBadgeClass(step.num)}>
								{#if currentStep > step.num}
									<Check class="h-3.5 w-3.5" />
								{:else}
									{step.num}
								{/if}
							</span>
							<span class={stepLabelClass(step.num)}>{step.label}</span>
						</button>
						{#if step.num < steps.length}
							<div
								class="h-px w-6 shrink-0 rounded-full sm:w-10 {currentStep > step.num
									? 'bg-brand-gold/70'
									: 'bg-surface-container-high'}"
							></div>
						{/if}
					{/each}
				</div>
			</nav>
		</div>
	{/snippet}
</PageHeader>
