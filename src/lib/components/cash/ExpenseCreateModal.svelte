<script lang="ts">
	import { X } from '@lucide/svelte';
	import {
		ALL_EXPENSE_CATEGORIES,
		ALL_EXPENSE_CURRENCIES,
		ALL_RATE_TYPES,
		EXPENSE_CATEGORY_LABELS,
		EXPENSE_TO_CURRENCY_CODE,
		RATE_TYPE_LABELS
	} from '$lib/shared/enums';
	import { getCurrencyLabel } from '$lib/shared/enums/currencyTypes';
	import {
		calculateExpenseAmountBcvUsd,
		getExpenseExchangeRateLabel,
		requiresExpenseExchangeRate,
		requiresExpenseRateType
	} from '$lib/shared/expenseCalculations';
	import { formatPrice } from '$lib/utils';
	import type { ExpenseFormData } from './expenseForm';

	interface Props {
		showCreate: boolean;
		form: ExpenseFormData;
		creating: boolean;
		bcvRateHint: number | null;
		usdtRateHint: number | null;
		onClose: () => void;
		onSubmit: (ev: SubmitEvent) => void;
	}

	let {
		showCreate = $bindable(),
		form = $bindable(),
		creating,
		bcvRateHint,
		usdtRateHint,
		onClose,
		onSubmit
	}: Props = $props();

	const mobileLabelClass = 'text-[10px] font-semibold tracking-[0.18em] text-outline uppercase';
	const fieldInputClass =
		'w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-slate-400 focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';

	const needsExchangeRate = $derived(requiresExpenseExchangeRate(form.currency));
	const needsRateType = $derived(requiresExpenseRateType(form.currency));
	const exchangeRateLabel = $derived(getExpenseExchangeRateLabel(form.currency));
	const normalizedAmountPreview = $derived.by(() => {
		const amount = Number(form.amount);
		const bcvRate = Number(form.bcvRate);
		const exchangeRate = Number(form.exchangeRate);

		return calculateExpenseAmountBcvUsd({
			currency: form.currency,
			amount: Number.isFinite(amount) ? amount : 0,
			bcvRate: Number.isFinite(bcvRate) ? bcvRate : 0,
			exchangeRate: Number.isFinite(exchangeRate) ? exchangeRate : undefined
		});
	});
</script>

{#if showCreate}
	<div
		class="fixed inset-0 z-50 bg-brand-navy/40 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="new-expense-title"
	>
		<div class="flex h-full items-end justify-center p-2 sm:items-center sm:p-4">
			<form
				onsubmit={onSubmit}
				class="flex h-[calc(100dvh-0.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] bg-surface-container-lowest shadow-xl sm:h-auto sm:max-h-[90dvh]"
			>
				<div class="border-b border-surface-container-high px-4 py-4 sm:px-6">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class={mobileLabelClass}>Nuevo egreso</p>
							<h2
								id="new-expense-title"
								class="mt-1 text-xl font-semibold tracking-[-0.02em] text-brand-navy"
							>
								Registrar egreso
							</h2>
							<p class="mt-1 text-sm text-on-surface-variant">
								Carga un gasto operativo con su moneda, referencia y notas.
							</p>
						</div>
						<button
							type="button"
							onclick={onClose}
							class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-brand-navy transition hover:bg-surface-container-high"
							aria-label="Cerrar formulario de egreso"
						>
							<X size={18} />
						</button>
					</div>
				</div>

				<div class="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Categoría *</span
							>
							<select bind:value={form.category} required class={fieldInputClass}>
								{#each ALL_EXPENSE_CATEGORIES as c (c)}
									<option value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Fecha *</span
							>
							<input type="date" bind:value={form.expenseDate} required class={fieldInputClass} />
						</label>

						<label class="col-span-full flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Descripción *</span
							>
							<input
								type="text"
								bind:value={form.description}
								required
								minlength="3"
								maxlength="500"
								class={fieldInputClass}
								placeholder="Pago de electricidad de noviembre"
							/>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Moneda *</span
							>
							<select bind:value={form.currency} required class={fieldInputClass}>
								{#each ALL_EXPENSE_CURRENCIES as c (c)}
									<option value={c}>{getCurrencyLabel(EXPENSE_TO_CURRENCY_CODE[c])}</option>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Monto *</span
							>
							<input
								type="number"
								min="0"
								step="0.01"
								inputmode="decimal"
								bind:value={form.amount}
								required
								class={`${fieldInputClass} text-right font-mono`}
							/>
						</label>

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Tasa BCV referencia *</span
							>
							<input
								type="number"
								min="0"
								step="0.0001"
								inputmode="decimal"
								bind:value={form.bcvRate}
								required
								class={`${fieldInputClass} text-right font-mono`}
							/>
							{#if bcvRateHint}
								<button
									type="button"
									class="self-start rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-brand-blue"
									onclick={() => (form.bcvRate = (bcvRateHint ?? 0).toFixed(2))}
								>
									Usar BCV: {bcvRateHint.toFixed(2)}
								</button>
							{/if}
						</label>

						{#if needsExchangeRate}
							<label class="flex flex-col gap-1.5 text-sm">
								<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
									{exchangeRateLabel} *
								</span>
								<input
									type="number"
									min="0"
									step="0.0001"
									inputmode="decimal"
									bind:value={form.exchangeRate}
									required
									class={`${fieldInputClass} text-right font-mono`}
								/>
								{#if form.currency === 'VES' && bcvRateHint}
									<button
										type="button"
										class="self-start rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-brand-blue"
										onclick={() => (form.exchangeRate = (bcvRateHint ?? 0).toFixed(2))}
									>
										Usar BCV: {bcvRateHint.toFixed(2)}
									</button>
								{:else if form.currency === 'USDT' && usdtRateHint}
									<button
										type="button"
										class="self-start rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-brand-blue"
										onclick={() => (form.exchangeRate = (usdtRateHint ?? 0).toFixed(2))}
									>
										Usar USDT: {usdtRateHint.toFixed(2)}
									</button>
								{/if}
							</label>

							{#if needsRateType}
								<label class="flex flex-col gap-1.5 text-sm">
									<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
										>Tipo de tasa *</span
									>
									<select bind:value={form.rateType} required class={fieldInputClass}>
										{#each ALL_RATE_TYPES as t (t)}
											<option value={t}>{RATE_TYPE_LABELS[t]}</option>
										{/each}
									</select>
								</label>
							{/if}
						{/if}

						{#if normalizedAmountPreview > 0}
							<div
								class="col-span-full rounded-xl bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant"
							>
								Se registrarán <span class="font-mono font-semibold text-brand-navy"
									>{formatPrice(normalizedAmountPreview)}</span
								>
								como USD BCV.
							</div>
						{/if}

						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Referencia</span
							>
							<input
								type="text"
								bind:value={form.reference}
								maxlength="100"
								class={fieldInputClass}
								placeholder="Nº de factura, recibo..."
							/>
						</label>

						<label class="col-span-full flex flex-col gap-1.5 text-sm">
							<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
								>Notas</span
							>
							<textarea bind:value={form.notes} maxlength="1000" rows="3" class={fieldInputClass}
							></textarea>
						</label>
					</div>
				</div>

				<div
					class="border-t border-surface-container-high bg-surface-container-low px-4 py-3 sm:px-6"
				>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							onclick={onClose}
							disabled={creating}
							class="rounded-xl bg-surface-container-high px-4 py-3 text-sm font-semibold text-brand-navy transition hover:bg-surface-container-highest disabled:opacity-50"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={creating}
							class="rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold tracking-[0.12em] text-brand-navy uppercase transition hover:bg-brand-gold-dark disabled:opacity-50"
						>
							{creating ? 'Guardando...' : 'Registrar egreso'}
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}
