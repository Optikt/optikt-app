<script lang="ts">
	import { CalendarDays, CreditCard, Info, X } from '@lucide/svelte';
	import {
		PurchasePaymentTerms,
		getPurchasePaymentTermsLabel,
		PurchaseSourceCurrency
	} from '$lib/shared/enums';
	import { getSourceCurrencySymbol } from '$lib/shared/purchaseOrderCurrencies';
	import { formatPrice } from '$lib/utils';
	import { validateCreditTerms } from './purchaseOrderDraft';
	import SegmentedToggle from '$lib/components/ui/SegmentedToggle.svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';

	interface Props {
		paymentTerms: PurchasePaymentTerms;
		creditDueDate: string | null;
		earlyPaymentDiscountPercent: number | null;
		earlyPaymentDiscountDeadline: string | null;
		totalNetAmount: number;
		totalNetAmountAlt?: number;
		sourceCurrency?: string;
		disabled?: boolean;
		onPaymentTermsChange?: (value: PurchasePaymentTerms) => void;
		onCreditDueDateChange?: (value: string | null) => void;
		onEarlyPaymentDiscountPercentChange?: (value: number | null) => void;
		onEarlyPaymentDiscountDeadlineChange?: (value: string | null) => void;
		bare?: boolean;
		compact?: boolean;
	}

	let {
		paymentTerms,
		creditDueDate,
		earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline,
		totalNetAmount,
		totalNetAmountAlt,
		sourceCurrency = PurchaseSourceCurrency.USD,
		disabled = false,
		onPaymentTermsChange,
		onCreditDueDateChange,
		onEarlyPaymentDiscountPercentChange,
		onEarlyPaymentDiscountDeadlineChange,
		bare = false,
		compact = false
	}: Props = $props();

	let creditDrawerOpen = $state(false);

	const paymentOptions = [
		{ value: PurchasePaymentTerms.CONTADO, label: 'Contado' },
		{ value: PurchasePaymentTerms.CREDIT, label: 'Crédito' }
	];

	const isCredit = $derived(paymentTerms === PurchasePaymentTerms.CREDIT);
	const validation = $derived(
		validateCreditTerms(
			paymentTerms,
			creditDueDate,
			earlyPaymentDiscountPercent,
			earlyPaymentDiscountDeadline
		)
	);

	function parseOptionalNumber(value: string): number | null {
		const normalized = value.trim();
		if (!normalized) return null;
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function formatOptionalNumber(value: number | null | undefined): string {
		return value == null ? '' : String(value);
	}

	function selectPaymentTerms(nextTerms: PurchasePaymentTerms) {
		if (disabled || nextTerms === paymentTerms) return;
		onPaymentTermsChange?.(nextTerms);
		if (nextTerms === PurchasePaymentTerms.CONTADO) {
			onCreditDueDateChange?.(null);
			onEarlyPaymentDiscountPercentChange?.(null);
			onEarlyPaymentDiscountDeadlineChange?.(null);
		}
	}

	function creditFieldClass() {
		return 'w-full rounded-xl border border-outline-variant/25 bg-surface-container px-3 py-2.5 text-sm text-brand-navy';
	}
</script>

{#if bare}
	<div class="flex flex-col gap-3">
		<SegmentedToggle
			value={paymentTerms}
			options={paymentOptions}
			onchange={(val) => selectPaymentTerms(val as PurchasePaymentTerms)}
			{disabled}
		/>

		{#if isCredit}
			{#if compact}
				<button
					type="button"
					onclick={() => (creditDrawerOpen = true)}
					class="flex items-center justify-between rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low/30 p-3 text-sm text-on-surface-variant transition-colors hover:border-brand-navy/30 hover:bg-surface-container-low"
				>
					<span>Configurar términos del crédito</span>
					<CalendarDays class="h-4 w-4 shrink-0 text-on-surface-variant" />
				</button>

				<SlideOver bind:open={creditDrawerOpen} size="md">
					{#snippet header({ onclose })}
						<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
							<p class="text-sm font-semibold text-brand-navy">Términos del crédito</p>
							<button
								type="button"
								onclick={onclose}
								class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-container-high hover:text-slate-600"
							>
								<X class="h-4 w-4" />
							</button>
						</div>
					{/snippet}

					<div class="space-y-5">
						{#if validation.issues.length > 0}
							<div
								class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
							>
								<p class="font-semibold">Ajusta los términos antes de guardar</p>
								<ul class="mt-2 space-y-1">
									{#each validation.issues as issue (`${issue}-${paymentTerms}`)}
										<li>{issue}</li>
									{/each}
								</ul>
							</div>
						{/if}

						<div class="grid gap-4 md:grid-cols-3">
							<label class="space-y-2 text-sm">
								<span
									class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
								>
									Vencimiento
									<span
										class="inline-flex cursor-help"
										title="Fecha máxima acordada para liquidar el crédito de esta compra."
									>
										<Info class="h-3 w-3 shrink-0 text-outline" />
									</span>
								</span>
								<input
									type="date"
									value={creditDueDate ?? ''}
									{disabled}
									oninput={(event) =>
										onCreditDueDateChange?.(
											(event.currentTarget as HTMLInputElement).value || null
										)}
									class={creditFieldClass()}
								/>
							</label>

							<label class="space-y-2 text-sm">
								<span
									class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
								>
									Pronto pago %
									<span
										class="inline-flex cursor-help"
										title="Incentivo que el proveedor concede si se paga antes de la fecha límite. No afecta costos de inventario."
									>
										<Info class="h-3 w-3 shrink-0 text-outline" />
									</span>
								</span>
								<input
									type="number"
									min="0"
									max="100"
									step="0.01"
									inputmode="decimal"
									value={formatOptionalNumber(earlyPaymentDiscountPercent)}
									{disabled}
									oninput={(event) =>
										onEarlyPaymentDiscountPercentChange?.(
											parseOptionalNumber((event.currentTarget as HTMLInputElement).value)
										)}
									class={`${creditFieldClass()} font-mono`}
									placeholder="5"
								/>
							</label>

							<label class="space-y-2 text-sm">
								<span
									class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
								>
									Límite pronto pago
									<span
										class="inline-flex cursor-help"
										title="Último día para optar por el beneficio de pronto pago."
									>
										<Info class="h-3 w-3 shrink-0 text-outline" />
									</span>
								</span>
								<input
									type="date"
									value={earlyPaymentDiscountDeadline ?? ''}
									{disabled}
									oninput={(event) =>
										onEarlyPaymentDiscountDeadlineChange?.(
											(event.currentTarget as HTMLInputElement).value || null
										)}
									class={creditFieldClass()}
								/>
							</label>
						</div>
					</div>

					{#snippet footer()}
						<div class="border-t border-slate-200 px-6 py-3">
							<button
								type="button"
								onclick={() => (creditDrawerOpen = false)}
								class="w-full rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy/90"
							>
								Listo
							</button>
						</div>
					{/snippet}
				</SlideOver>
			{:else}
				<div class="rounded-2xl border border-outline-variant/20 bg-surface-container-low/30 p-4">
					<div class="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-navy">
						<CalendarDays class="h-4 w-4" />
						Términos del crédito
					</div>

					{#if validation.issues.length > 0}
						<div
							class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
						>
							<p class="font-semibold">Ajusta los términos antes de guardar</p>
							<ul class="mt-2 space-y-1">
								{#each validation.issues as issue (`${issue}-${paymentTerms}`)}
									<li>{issue}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<div class="grid gap-4 md:grid-cols-3">
						<label class="space-y-2 text-sm">
							<span
								class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
							>
								Vencimiento
								<span
									class="inline-flex cursor-help"
									title="Fecha máxima acordada para liquidar el crédito de esta compra."
								>
									<Info class="h-3 w-3 shrink-0 text-outline" />
								</span>
							</span>
							<input
								type="date"
								value={creditDueDate ?? ''}
								{disabled}
								oninput={(event) =>
									onCreditDueDateChange?.((event.currentTarget as HTMLInputElement).value || null)}
								class={creditFieldClass()}
							/>
						</label>

						<label class="space-y-2 text-sm">
							<span
								class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
							>
								Pronto pago %
								<span
									class="inline-flex cursor-help"
									title="Incentivo que el proveedor concede si se paga antes de la fecha límite. No afecta costos de inventario."
								>
									<Info class="h-3 w-3 shrink-0 text-outline" />
								</span>
							</span>
							<input
								type="number"
								min="0"
								max="100"
								step="0.01"
								inputmode="decimal"
								value={formatOptionalNumber(earlyPaymentDiscountPercent)}
								{disabled}
								oninput={(event) =>
									onEarlyPaymentDiscountPercentChange?.(
										parseOptionalNumber((event.currentTarget as HTMLInputElement).value)
									)}
								class={`${creditFieldClass()} font-mono`}
								placeholder="5"
							/>
						</label>

						<label class="space-y-2 text-sm">
							<span
								class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
							>
								Límite pronto pago
								<span
									class="inline-flex cursor-help"
									title="Último día para optar por el beneficio de pronto pago."
								>
									<Info class="h-3 w-3 shrink-0 text-outline" />
								</span>
							</span>
							<input
								type="date"
								value={earlyPaymentDiscountDeadline ?? ''}
								{disabled}
								oninput={(event) =>
									onEarlyPaymentDiscountDeadlineChange?.(
										(event.currentTarget as HTMLInputElement).value || null
									)}
								class={creditFieldClass()}
							/>
						</label>
					</div>
				</div>
			{/if}
		{:else}
			<div
				class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-3 text-sm text-on-surface-variant"
			>
				La compra se liquida de contado. No se registran vencimientos ni pronto pago.
			</div>
		{/if}
	</div>
{:else}
	<section class="glass-card overflow-hidden">
		<div
			class="flex flex-col gap-4 border-b border-outline-variant/15 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
				>
					<CreditCard class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-xl font-semibold text-brand-navy">Condición de pago</h2>
					<p class="text-sm text-on-surface-variant">
						Define si la compra se liquida de contado o con crédito simple del proveedor.
					</p>
				</div>
			</div>
			<div
				class="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.14em] text-on-surface-variant uppercase"
			>
				<span
					class="rounded-full border border-outline-variant/25 bg-surface-container-low px-3 py-1.5"
				>
					{getPurchasePaymentTermsLabel(paymentTerms)}
				</span>
				<span
					class="rounded-full border border-outline-variant/25 bg-surface-container-low px-3 py-1.5"
				>
					{#if sourceCurrency !== PurchaseSourceCurrency.USD && totalNetAmountAlt != null}
						{totalNetAmountAlt.toFixed(2)} {getSourceCurrencySymbol(sourceCurrency)} neto
					{:else}
						{formatPrice(totalNetAmount)} neto
					{/if}
				</span>
			</div>
		</div>

		<div class="space-y-6 px-6 py-6">
			<SegmentedToggle
				value={paymentTerms}
				options={paymentOptions}
				onchange={(val) => selectPaymentTerms(val as PurchasePaymentTerms)}
				{disabled}
			/>

			{#if isCredit}
				<div class="rounded-2xl border border-outline-variant/20 bg-surface-container-low/30 p-4">
					<div class="mb-4 flex items-center gap-2 text-sm font-semibold text-brand-navy">
						<CalendarDays class="h-4 w-4" />
						Términos del crédito
					</div>

					{#if validation.issues.length > 0}
						<div
							class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
						>
							<p class="font-semibold">Ajusta los términos antes de guardar</p>
							<ul class="mt-2 space-y-1">
								{#each validation.issues as issue (`${issue}-${paymentTerms}`)}
									<li>{issue}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<div class="grid gap-4 md:grid-cols-3">
						<label class="space-y-2 text-sm">
							<span
								class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
							>
								Vencimiento
								<span
									class="inline-flex cursor-help"
									title="Fecha máxima acordada para liquidar el crédito de esta compra."
								>
									<Info class="h-3 w-3 shrink-0 text-outline" />
								</span>
							</span>
							<input
								type="date"
								value={creditDueDate ?? ''}
								{disabled}
								oninput={(event) =>
									onCreditDueDateChange?.((event.currentTarget as HTMLInputElement).value || null)}
								class={creditFieldClass()}
							/>
						</label>

						<label class="space-y-2 text-sm">
							<span
								class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
							>
								Pronto pago %
								<span
									class="inline-flex cursor-help"
									title="Incentivo que el proveedor concede si se paga antes de la fecha límite. No afecta costos de inventario."
								>
									<Info class="h-3 w-3 shrink-0 text-outline" />
								</span>
							</span>
							<input
								type="number"
								min="0"
								max="100"
								step="0.01"
								inputmode="decimal"
								value={formatOptionalNumber(earlyPaymentDiscountPercent)}
								{disabled}
								oninput={(event) =>
									onEarlyPaymentDiscountPercentChange?.(
										parseOptionalNumber((event.currentTarget as HTMLInputElement).value)
									)}
								class={`${creditFieldClass()} font-mono`}
								placeholder="5"
							/>
						</label>

						<label class="space-y-2 text-sm">
							<span
								class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
							>
								Límite pronto pago
								<span
									class="inline-flex cursor-help"
									title="Último día para optar por el beneficio de pronto pago."
								>
									<Info class="h-3 w-3 shrink-0 text-outline" />
								</span>
							</span>
							<input
								type="date"
								value={earlyPaymentDiscountDeadline ?? ''}
								{disabled}
								oninput={(event) =>
									onEarlyPaymentDiscountDeadlineChange?.(
										(event.currentTarget as HTMLInputElement).value || null
									)}
								class={creditFieldClass()}
							/>
						</label>
					</div>
				</div>
			{:else}
				<div
					class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 text-sm text-on-surface-variant"
				>
					La compra se liquida de contado. No se registran vencimientos ni pronto pago.
				</div>
			{/if}
		</div>
	</section>
{/if}
