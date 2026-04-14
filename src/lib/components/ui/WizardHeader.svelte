<script lang="ts">
	import { Check } from '@lucide/svelte';
	import PageHeader from './PageHeader.svelte';

	interface WizardStepMeta {
		num: number;
		label: string;
	}

	interface Props {
		title: string;
		subtitle?: string;
		steps: WizardStepMeta[];
		currentStep: number;
		canNavigateToStep: (step: number) => boolean;
		onStepSelect: (step: number) => void;
	}

	let { title, subtitle, steps, currentStep, canNavigateToStep, onStepSelect }: Props = $props();

	function stepButtonClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;

		const base = 'group flex flex-col items-center gap-3 text-center transition-all duration-200';
		const state = isActive || isComplete ? 'text-brand-navy' : 'text-slate-400';
		const cursor = canNavigateToStep(stepNum) ? 'cursor-pointer' : 'cursor-not-allowed';
		return `${base} ${state} ${cursor}`;
	}

	function stepBadgeClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const base =
			'flex h-12 w-12 items-center justify-center rounded-2xl font-mono text-base font-bold transition-all duration-200';
		const state = isActive
			? 'bg-brand-navy text-white shadow-[0_18px_40px_rgba(21,35,70,0.18)]'
			: isComplete
				? 'bg-brand-gold text-brand-navy shadow-sm'
				: 'bg-surface-container-high text-outline group-hover:bg-surface-container-highest group-hover:text-brand-navy';
		return `${base} ${state}`;
	}

	function stepLabelClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const base = 'text-[11px] font-semibold tracking-[0.16em] uppercase whitespace-nowrap';
		const state =
			isActive || isComplete
				? 'text-brand-navy'
				: 'text-slate-400 group-hover:text-on-surface-variant';
		return `${base} ${state}`;
	}

	function stepConnectorClass(stepNum: number): string {
		return `mt-6 h-px w-10 shrink-0 rounded-full sm:w-16 ${currentStep > stepNum ? 'bg-brand-gold/70' : 'bg-surface-container-high'}`;
	}
</script>

<PageHeader {title} {subtitle}>
	{#snippet actions()}
		<nav aria-label={title} class="overflow-x-auto xl:-mt-4 xl:pt-0">
			<div class="flex min-w-max items-start justify-start gap-2 px-1 sm:gap-4 xl:justify-end">
				{#each steps as step (step.num)}
					<div class="flex items-start gap-2 sm:gap-4">
						<button
							type="button"
							onclick={() => {
								if (canNavigateToStep(step.num)) onStepSelect(step.num);
							}}
							disabled={!canNavigateToStep(step.num)}
							class={stepButtonClass(step.num)}
						>
							<span class={stepBadgeClass(step.num)}>
								{#if currentStep > step.num}
									<Check class="h-4 w-4" />
								{:else}
									{step.num}
								{/if}
							</span>
							<span class={stepLabelClass(step.num)}>{step.label}</span>
						</button>
						{#if step.num < steps.length}
							<div class={stepConnectorClass(step.num)}></div>
						{/if}
					</div>
				{/each}
			</div>
		</nav>
	{/snippet}
</PageHeader>
