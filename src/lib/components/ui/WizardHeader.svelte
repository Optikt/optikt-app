<script lang="ts">
	import { Hash, Check } from '@lucide/svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { CalendarDate, getLocalTimeZone, type DateValue } from '@internationalized/date';
	import type { Snippet } from 'svelte';
	import PageHeader from './PageHeader.svelte';
	import Calendar from '$lib/components/ui/calendar/calendar.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

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

	let open = $state(false);
	let value = $state<DateValue | undefined>();

	$effect(() => {
		if (value) {
			const d = value.toDate(getLocalTimeZone());
			orderDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		}
	});

	$effect(() => {
		if (orderDate && /^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
			const [y, m, d] = orderDate.split('-').map(Number);
			const parsed = new CalendarDate(y, m, d);
			if (!value || value.compare(parsed) !== 0) {
				value = parsed;
			}
		}
	});

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
		<div class="flex items-start justify-between gap-4">
			<div class="flex min-w-0 flex-col gap-1">
				{#if breadcrumbs}
					{@render breadcrumbs()}
				{/if}
				{#if orderNumber || orderDate}
					<div class="flex items-center gap-2 text-xs">
						{#if orderNumber}
							<div
								class="flex items-center gap-1.5 rounded-lg bg-surface-container-high px-2.5 py-1 text-brand-blue"
							>
								<Hash class="h-3.5 w-3.5" />
								<span class="font-mono font-semibold">{orderNumber}</span>
							</div>
						{/if}
						<Popover.Root bind:open>
							<Popover.Trigger >
								{#snippet child({ props })}
									<Button
										{...props}
										class="h-7 gap-1.5 rounded-lg border !border-outline-variant/30 bg-surface-container text-on-surface px-2.5 py-1 text-xs font-normal !text-black hover:border-brand-blue hover:bg-surface-container-high"
									>
									<!-- class="hover:border-brand-blue hover:bg-surface-container-high focus:border-brand-blue focus:ring-1 focus:ring-brand-blue" -->
										{value
											? value.toDate(getLocalTimeZone()).toLocaleDateString('es-ES', {
													day: '2-digit',
													month: '2-digit',
													year: 'numeric'
												})
											: 'Seleccionar fecha'}
										<ChevronDownIcon class="size-3" />
									</Button>
								{/snippet}
							</Popover.Trigger>
							<Popover.Content class="w-auto overflow-hidden border border-border bg-white p-0 text-black shadow-lg" align="start">
								<Calendar
									type="single"
									bind:value
									captionLayout="dropdown"
									class="bg-white"
									onValueChange={() => {
										open = false;
									}}
								/>
							</Popover.Content>
						</Popover.Root>
					</div>
				{/if}
			</div>
			<nav aria-label={title} class="flex-shrink-0">
				<div class="flex items-center gap-1.5 sm:gap-2">
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
