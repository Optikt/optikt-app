<script lang="ts">
	import { CalendarDays, CreditCard, Info, Plus, Trash2 } from '@lucide/svelte';
	import { PurchasePaymentTerms, getPurchasePaymentTermsLabel } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import {
		createEmptyPurchaseOrderDraftInstallment,
		validateCreditSchedule,
		type PurchaseOrderDraftInstallment
	} from './purchaseOrderDraft';

	interface Props {
		paymentTerms: PurchasePaymentTerms;
		installments: PurchaseOrderDraftInstallment[];
		totalNetAmount: number;
		disabled?: boolean;
		onPaymentTermsChange?: (value: PurchasePaymentTerms) => void;
		onInstallmentsChange?: (value: PurchaseOrderDraftInstallment[]) => void;
	}

	let {
		paymentTerms,
		installments,
		totalNetAmount,
		disabled = false,
		onPaymentTermsChange,
		onInstallmentsChange
	}: Props = $props();

	const validation = $derived(validateCreditSchedule(paymentTerms, installments, totalNetAmount));
	const isCredit = $derived(paymentTerms === PurchasePaymentTerms.CREDIT);
	const scheduleDifferenceLabel = $derived.by(() => {
		if (!isCredit) return 'No aplica';
		if (Math.abs(validation.difference) <= 0.01) return 'Cuadra con el total neto';
		return validation.difference > 0
			? `Faltan ${formatPrice(Math.abs(validation.difference))}`
			: `Excede por ${formatPrice(Math.abs(validation.difference))}`;
	});

	function roundCurrency(value: number): number {
		return Number(value.toFixed(2));
	}

	function renumberInstallments(
		nextInstallments: PurchaseOrderDraftInstallment[]
	): PurchaseOrderDraftInstallment[] {
		return nextInstallments.map((installment, index) => ({
			...installment,
			installmentNumber: index + 1
		}));
	}

	function updateInstallments(nextInstallments: PurchaseOrderDraftInstallment[]) {
		onInstallmentsChange?.(renumberInstallments(nextInstallments));
	}

	function parseOptionalNumber(value: string): number | null {
		const normalized = value.trim();
		if (!normalized) return null;

		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function formatOptionalNumber(value: number | null | undefined): string {
		return value == null ? '' : String(value);
	}

	function addInstallment() {
		if (disabled) return;

		const nextInstallment = createEmptyPurchaseOrderDraftInstallment(installments.length + 1);
		if (installments.length === 0 && totalNetAmount > 0) {
			nextInstallment.expectedAmountUsd = roundCurrency(totalNetAmount);
		}

		updateInstallments([...installments, nextInstallment]);
	}

	function removeInstallment(installmentId: string) {
		if (disabled) return;
		updateInstallments(installments.filter((installment) => installment.id !== installmentId));
	}

	function updateInstallment(installmentId: string, patch: Partial<PurchaseOrderDraftInstallment>) {
		if (disabled) return;

		updateInstallments(
			installments.map((installment) =>
				installment.id === installmentId ? { ...installment, ...patch } : installment
			)
		);
	}

	function selectPaymentTerms(nextTerms: PurchasePaymentTerms) {
		if (disabled || nextTerms === paymentTerms) return;

		onPaymentTermsChange?.(nextTerms);

		if (nextTerms === PurchasePaymentTerms.CONTADO) {
			updateInstallments([]);
			return;
		}

		if (installments.length === 0) {
			const nextInstallment = createEmptyPurchaseOrderDraftInstallment(1);
			if (totalNetAmount > 0) {
				nextInstallment.expectedAmountUsd = roundCurrency(totalNetAmount);
			}
			updateInstallments([nextInstallment]);
		}
	}
</script>

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
					Define si la compra se liquida de contado o con cronograma de cuotas.
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
				{installments.length} cuota{installments.length === 1 ? '' : 's'}
			</span>
		</div>
	</div>

	<div class="space-y-6 px-6 py-6">
		<div class="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
			<div class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Tipo
				</p>
				<p class="mt-2 text-lg font-semibold text-brand-navy">
					{getPurchasePaymentTermsLabel(paymentTerms)}
				</p>
			</div>
			<div class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Total neto
				</p>
				<p class="mt-2 text-lg font-semibold text-brand-navy">{formatPrice(totalNetAmount)}</p>
			</div>
			<div class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Programado
				</p>
				<p class="mt-2 text-lg font-semibold text-brand-navy">
					{isCredit ? formatPrice(validation.scheduledAmount) : 'No aplica'}
				</p>
			</div>
			<div class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Diferencia
				</p>
				<p
					class={[
						'mt-2 text-sm font-semibold',
						!isCredit || Math.abs(validation.difference) <= 0.01
							? 'text-emerald-700'
							: 'text-amber-700'
					]}
				>
					{scheduleDifferenceLabel}
				</p>
			</div>
		</div>

		<div class="inline-flex rounded-xl bg-surface-container-low p-1 text-sm font-semibold">
			<button
				type="button"
				onclick={() => selectPaymentTerms(PurchasePaymentTerms.CONTADO)}
				class={[
					'rounded-lg px-4 py-2 transition-colors',
					paymentTerms === PurchasePaymentTerms.CONTADO
						? 'bg-surface-container-lowest text-brand-navy shadow-sm'
						: 'text-on-surface-variant hover:text-brand-navy',
					disabled ? 'cursor-not-allowed opacity-70' : ''
				]}
				aria-pressed={paymentTerms === PurchasePaymentTerms.CONTADO}
				{disabled}
			>
				Contado
			</button>
			<button
				type="button"
				onclick={() => selectPaymentTerms(PurchasePaymentTerms.CREDIT)}
				class={[
					'rounded-lg px-4 py-2 transition-colors',
					paymentTerms === PurchasePaymentTerms.CREDIT
						? 'bg-surface-container-lowest text-brand-navy shadow-sm'
						: 'text-on-surface-variant hover:text-brand-navy',
					disabled ? 'cursor-not-allowed opacity-70' : ''
				]}
				aria-pressed={paymentTerms === PurchasePaymentTerms.CREDIT}
				{disabled}
			>
				Crédito
			</button>
		</div>

		{#if isCredit}
			<div
				class="space-y-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/30 p-4"
			>
				<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div>
						<h3 class="text-sm font-semibold text-brand-navy">Cronograma de cuotas</h3>
						<p class="text-sm text-on-surface-variant">
							Distribuye el total neto según las fechas acordadas con el proveedor.
						</p>
					</div>
					<button
						type="button"
						onclick={addInstallment}
						{disabled}
						class="inline-flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-xs font-semibold tracking-[0.14em] text-brand-navy uppercase transition-colors hover:bg-surface-container"
					>
						<Plus class="h-4 w-4" />
						Agregar cuota
					</button>
				</div>

				{#if validation.issues.length > 0}
					<div
						class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
					>
						<p class="font-semibold">Ajusta el cronograma antes de guardar</p>
						<ul class="mt-2 space-y-1">
							{#each validation.issues as issue (`${issue}-${paymentTerms}`)}
								<li>{issue}</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="space-y-4">
					{#each installments as installment (installment.id)}
						<article
							class="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4"
						>
							<div class="mb-4 flex items-center justify-between gap-3">
								<div class="flex items-center gap-2 text-sm font-semibold text-brand-navy">
									<CalendarDays class="h-4 w-4" />
									Cuota #{installment.installmentNumber}
								</div>
								{#if installments.length > 1}
									<button
										type="button"
										onclick={() => removeInstallment(installment.id)}
										{disabled}
										class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-error-container/60 text-on-error-container transition-colors hover:bg-error-container"
										title="Eliminar cuota"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								{/if}
							</div>

							<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
								<label class="space-y-2 text-sm">
									<span
										class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
									>
										Vencimiento
										<Info
											class="h-3 w-3 shrink-0 text-outline"
											title="Fecha límite máxima para pagar esta cuota. Pasada esta fecha el pago queda en mora."
										/>
									</span>
									<input
										type="date"
										value={installment.dueDate}
										{disabled}
										oninput={(event) =>
											updateInstallment(installment.id, {
												dueDate: (event.currentTarget as HTMLInputElement).value
											})}
										class="w-full rounded-xl border border-outline-variant/25 bg-surface-container px-3 py-2.5 text-sm text-brand-navy"
									/>
								</label>

								<label class="space-y-2 text-sm">
									<span
										class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
									>
										Monto esperado USD
										<Info
											class="h-3 w-3 shrink-0 text-outline"
											title="Cuánto se espera pagar en esta cuota (en USD BCV). Obligatorio si hay más de una cuota."
										/>
									</span>
									<input
										type="number"
										min="0"
										step="0.01"
										inputmode="decimal"
										value={formatOptionalNumber(installment.expectedAmountUsd)}
										{disabled}
										oninput={(event) =>
											updateInstallment(installment.id, {
												expectedAmountUsd: parseOptionalNumber(
													(event.currentTarget as HTMLInputElement).value
												)
											})}
										class="w-full rounded-xl border border-outline-variant/25 bg-surface-container px-3 py-2.5 text-sm text-brand-navy"
									/>
								</label>

								<label class="space-y-2 text-sm">
									<span
										class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
									>
										Pronto pago %
										<Info
											class="h-3 w-3 shrink-0 text-outline"
											title="Descuento que ofrece el proveedor si pagás antes del límite. Ej: 5 = 5% de descuento sobre esta cuota."
										/>
									</span>
									<input
										type="number"
										min="0"
										max="100"
										step="0.01"
										inputmode="decimal"
										value={formatOptionalNumber(installment.earlyPaymentDiscountPercent)}
										{disabled}
										oninput={(event) =>
											updateInstallment(installment.id, {
												earlyPaymentDiscountPercent: parseOptionalNumber(
													(event.currentTarget as HTMLInputElement).value
												)
											})}
										class="w-full rounded-xl border border-outline-variant/25 bg-surface-container px-3 py-2.5 text-sm text-brand-navy"
									/>
								</label>

								<label class="space-y-2 text-sm">
									<span
										class="flex items-center gap-1 text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
									>
										Límite pronto pago
										<Info
											class="h-3 w-3 shrink-0 text-outline"
											title="Fecha tope para pagar y obtener el descuento. Debe ser anterior al vencimiento."
										/>
									</span>
									<input
										type="date"
										value={installment.earlyPaymentDiscountDeadline ?? ''}
										{disabled}
										oninput={(event) =>
											updateInstallment(installment.id, {
												earlyPaymentDiscountDeadline:
													(event.currentTarget as HTMLInputElement).value || null
											})}
										class="w-full rounded-xl border border-outline-variant/25 bg-surface-container px-3 py-2.5 text-sm text-brand-navy"
									/>
								</label>

								<label class="space-y-2 text-sm md:col-span-2 xl:col-span-4">
									<span
										class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase"
									>
										Notas de la cuota
									</span>
									<textarea
										rows="2"
										{disabled}
										oninput={(event) =>
											updateInstallment(installment.id, {
												notes: (event.currentTarget as HTMLTextAreaElement).value
											})}
										class="w-full rounded-xl border border-outline-variant/25 bg-surface-container px-3 py-2.5 text-sm text-brand-navy"
										>{installment.notes}</textarea
									>
								</label>
							</div>
						</article>
					{/each}
				</div>
			</div>
		{:else}
			<div
				class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
			>
				No necesitas registrar cuotas. La PO quedará lista para pagar apenas se confirme.
			</div>
		{/if}
	</div>
</section>
