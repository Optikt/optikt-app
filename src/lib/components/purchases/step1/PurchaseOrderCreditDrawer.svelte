<script lang="ts">
	import { X } from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import { PurchasePaymentTerms } from '$lib/shared/enums';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import FieldWrapper from './FieldWrapper.svelte';

	interface Props {
		open: boolean;
		creditDueDate: string | null;
		earlyPaymentDiscountPercent: number | null;
		earlyPaymentDiscountDeadline: string | null;
		onCreditDueDateChange?: (value: string | null) => void;
		onEarlyPaymentDiscountPercentChange?: (value: number | null) => void;
		onEarlyPaymentDiscountDeadlineChange?: (value: string | null) => void;
		onclose?: () => void;
	}

	let {
		open = $bindable(false),
		creditDueDate,
		earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline,
		onCreditDueDateChange,
		onEarlyPaymentDiscountPercentChange,
		onEarlyPaymentDiscountDeadlineChange,
		onclose
	}: Props = $props();

	let tempDueDate = $state<string | null>(null);
	let tempEarlyPercent = $state<number | null>(null);
	let tempEarlyDeadline = $state<string | null>(null);
	let hasEarlyPayment = $state(false);

	$effect(() => {
		if (open) {
			tempDueDate = creditDueDate;
			tempEarlyPercent = earlyPaymentDiscountPercent;
			tempEarlyDeadline = earlyPaymentDiscountDeadline;
			hasEarlyPayment = !!earlyPaymentDiscountPercent || !!earlyPaymentDiscountDeadline;
		}
	});

	const canSave = $derived(
		!!tempDueDate && (!hasEarlyPayment || (tempEarlyDeadline && tempEarlyPercent! > 0))
	);

	function handleToggleEarlyPayment() {
		hasEarlyPayment = !hasEarlyPayment;
		if (!hasEarlyPayment) {
			tempEarlyPercent = null;
			tempEarlyDeadline = null;
		}
	}

	function handleSave() {
		onCreditDueDateChange?.(tempDueDate);
		onEarlyPaymentDiscountPercentChange?.(tempEarlyPercent);
		onEarlyPaymentDiscountDeadlineChange?.(tempEarlyDeadline);
		open = false;
	}

	function handleCancel() {
		tempDueDate = creditDueDate;
		tempEarlyPercent = earlyPaymentDiscountPercent;
		tempEarlyDeadline = earlyPaymentDiscountDeadline;
		hasEarlyPayment = !!earlyPaymentDiscountPercent || !!earlyPaymentDiscountDeadline;
		open = false;
		onclose?.();
	}
</script>

<SlideOver
	bind:open
	direction={typeof window !== 'undefined' && window.innerWidth < 768 ? 'bottom' : 'right'}
	size="md"
	onclose={handleCancel}
>
	{#snippet header({ onclose: close })}
		<div class="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
			<p class="text-sm font-semibold text-brand-navy">Condiciones del crédito</p>
			<button
				type="button"
				onclick={close}
				class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-container-high hover:text-slate-600"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/snippet}

	<div class="space-y-5">
		<FieldWrapper label="Fecha de vencimiento del crédito" required>
			<input
				type="date"
				bind:value={tempDueDate}
				class="w-full rounded-lg border-none bg-surface-container-high px-3 py-2 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			/>
		</FieldWrapper>

		<label class="flex items-center gap-2 cursor-pointer select-none">
			<input
				type="checkbox"
				checked={hasEarlyPayment}
				onclick={handleToggleEarlyPayment}
				class="h-4 w-4 rounded border-outline-variant/30 text-brand-navy focus:ring-brand-navy"
			/>
			<span class="text-sm font-medium text-brand-navy">Beneficio de pronto pago</span>
		</label>

		<div use:autoAnimate>
			{#if hasEarlyPayment}
				<div class="grid grid-cols-2 gap-4">
					<FieldWrapper label="Fecha máxima para pronto pago">
						<input
							type="date"
							bind:value={tempEarlyDeadline}
							class="w-full rounded-lg border-none bg-surface-container-high px-3 py-2 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
						/>
					</FieldWrapper>
					<FieldWrapper label="% de beneficio">
						<div class="relative">
							<input
								type="number"
								min="0"
								max="100"
								step="0.01"
								bind:value={tempEarlyPercent}
								placeholder="0"
								class="w-full rounded-lg border-none bg-surface-container-high px-3 py-2 pr-8 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 font-mono"
							/>
							<span
								class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-on-surface-variant"
								>%</span
							>
						</div>
					</FieldWrapper>
				</div>
				<p class="text-xs text-on-surface-variant">
					Pagar antes de la fecha máxima aplica el % de descuento sobre el total de la compra.
				</p>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<div class="flex gap-3 border-t border-outline-variant/15 px-6 py-3">
			<button
				type="button"
				onclick={handleCancel}
				class="flex-1 rounded-lg border border-outline-variant/30 px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				Cancelar
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={!canSave}
				class="flex-1 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
			>
				Guardar condiciones
			</button>
		</div>
	{/snippet}
</SlideOver>
