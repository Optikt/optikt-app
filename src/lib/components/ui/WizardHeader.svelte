<script lang="ts">
	import { Hash, Check, Pencil, RotateCcw } from '@lucide/svelte';
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
		/** Render an editable input instead of a static badge (e.g. admin backfill). */
		orderNumberEditable?: boolean;
		/** Refetch the latest suggested order number (MAX + 1) and reset the input. */
		onResetOrderNumber?: () => void | Promise<void>;
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
		orderNumber = $bindable(),
		orderNumberEditable = false,
		onResetOrderNumber,
		orderDate = $bindable(),
		breadcrumbs
	}: Props = $props();

	let open = $state(false);
	let value = $state<DateValue | undefined>();

	// Order number: edit-on-demand (admin). Enter/Esc/blur commit; reset button refetches the suggestion.
	let editingOrderNumber = $state(false);
	let orderNumberEditEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (editingOrderNumber) {
			orderNumberEditEl?.focus();
		}
	});

	function enableOrderNumberEdit() {
		if (!orderNumberEditable) return;
		editingOrderNumber = true;
	}

	function commitOrderNumberEdit() {
		editingOrderNumber = false;
	}

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
		<div class="flex items-center justify-between gap-4">
			<div class="flex min-w-0 flex-col gap-1">
				{#if breadcrumbs}
					{@render breadcrumbs()}
				{/if}
				{#if orderNumberEditable || orderNumber || orderDate}
					<div class="flex items-center gap-2 text-xs">
						{#if orderNumberEditable || orderNumber}
							{#if orderNumberEditable}
								{#if editingOrderNumber}
									<div
										class="flex items-center gap-1.5 rounded-lg bg-surface-container-high px-2.5 py-1 text-brand-blue ring-1 ring-brand-blue/40"
										title="Enter para guardar"
									>
										<Hash class="h-3.5 w-3.5" />
										<input
											bind:this={orderNumberEditEl}
											type="text"
											inputmode="numeric"
											pattern="[0-9]*"
											class="w-16 bg-transparent font-mono font-semibold text-brand-blue outline-none"
											aria-label="Número de orden (vacío = automático)"
											bind:value={orderNumber}
											onkeydown={(event) => {
												if (event.key === 'Enter' || event.key === 'Escape') {
													commitOrderNumberEdit();
												}
											}}
											onblur={commitOrderNumberEdit}
										/>
										<button
											type="button"
											onmousedown={(event) => event.preventDefault()}
											onclick={onResetOrderNumber}
											class="cursor-pointer rounded p-0.5 text-brand-blue/50 transition-colors hover:text-brand-blue"
											title="Usar último número generado"
											aria-label="Usar último número generado"
										>
											<RotateCcw class="h-3 w-3" />
										</button>
										<Check
											class="h-3 w-3 shrink-0 cursor-pointer text-brand-blue"
											onmousedown={(event) => event.preventDefault()}
											onclick={commitOrderNumberEdit}
										/>
									</div>
								{:else}
									<button
										type="button"
										onclick={enableOrderNumberEdit}
										class="flex cursor-pointer items-center gap-1.5 rounded-lg bg-surface-container-high px-2.5 py-1 text-brand-blue transition-colors hover:bg-surface-container-highest hover:ring-1 hover:ring-brand-blue/40"
										title="Editar número de orden (vacío = automático)"
									>
										<Hash class="h-3.5 w-3.5" />
										<span class="font-mono font-semibold">{orderNumber}</span>
										<Pencil
											class="h-3 w-3 shrink-0 text-brand-blue/50 transition-colors group-hover:text-brand-blue"
										/>
									</button>
								{/if}
							{:else}
								<div
									class="flex items-center gap-1.5 rounded-lg bg-surface-container-high px-2.5 py-1 text-brand-blue"
								>
									<Hash class="h-3.5 w-3.5" />
									<span class="font-mono font-semibold">{orderNumber}</span>
								</div>
							{/if}
						{/if}
						<Popover.Root bind:open>
							<Popover.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										class="h-7 gap-1.5 rounded-lg border !border-outline-variant/30 bg-surface-container px-2.5 py-1 text-xs font-normal !text-black text-on-surface hover:border-brand-blue hover:bg-surface-container-high"
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
							<Popover.Content
								class="w-auto overflow-hidden border border-border bg-white p-0 text-black shadow-lg"
								align="start"
							>
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
