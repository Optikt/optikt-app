<script lang="ts">
	import { ConfirmModal } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';
	import type { EarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';
	import type { PurchasePaymentPayload } from './purchasePayment';

	interface Props {
		showOverpaymentModal: boolean;
		showEarlyPaymentBenefitModal: boolean;
		pendingAddPayload: PurchasePaymentPayload | null;
		pendingBenefitSuggestion: EarlyPaymentDiscountSuggestion | null;
		benefitAmountInput: string;
		benefitNoteInput: string;
		submitting: boolean;
		resolvedUsdDisplay: string;
		pendingBalanceUsd?: number;
		overpaymentDisplay: string;
		onConfirmOverpayment: () => void;
		onCancelOverpayment: () => void;
		onBenefitApply: () => void;
		onBenefitNote: () => void;
		onCancelBenefit: () => void;
	}

	let {
		showOverpaymentModal = $bindable(),
		showEarlyPaymentBenefitModal = $bindable(),
		pendingAddPayload,
		pendingBenefitSuggestion,
		benefitAmountInput = $bindable(),
		benefitNoteInput = $bindable(),
		submitting,
		resolvedUsdDisplay,
		pendingBalanceUsd,
		overpaymentDisplay,
		onConfirmOverpayment,
		onCancelOverpayment,
		onBenefitApply,
		onBenefitNote,
		onCancelBenefit
	}: Props = $props();
</script>

<ConfirmModal
	bind:open={showOverpaymentModal}
	title="Pago supera el saldo"
	message={pendingAddPayload != null
		? `Este pago de ${resolvedUsdDisplay} supera el saldo pendiente de ${formatPrice(pendingBalanceUsd ?? 0)} en ${overpaymentDisplay}. ¿Registrar de todas formas?`
		: ''}
	confirmLabel="Registrar igual"
	confirmColor="yellow"
	loading={submitting}
	onConfirm={onConfirmOverpayment}
	onCancel={onCancelOverpayment}
/>

<ConfirmModal
	bind:open={showEarlyPaymentBenefitModal}
	title="Pronto pago disponible"
	size="lg"
	confirmLabel="Aplicar a esta PO"
	secondaryLabel="Solo anotarlo"
	cancelLabel="No registrar todavía"
	confirmColor="green"
	secondaryColor="alternative"
	loading={submitting}
	onConfirm={onBenefitApply}
	onSecondary={onBenefitNote}
	onCancel={onCancelBenefit}
	permanent
>
	{#snippet body()}
		<div class="space-y-4 text-sm text-on-surface">
			<p>
				El pago califica para pronto pago de {pendingBenefitSuggestion?.percent ?? 0}% antes de {pendingBenefitSuggestion?.deadline ??
					'la fecha límite'}.
			</p>
			{#if pendingBenefitSuggestion}
				<p class="rounded-xl bg-info-container/40 px-3 py-2 text-xs text-on-surface-variant">
					Si lo aplicas al saldo, el pago se registrará por
					{formatPrice(pendingBenefitSuggestion.currentBalance - Number(benefitAmountInput || 0))}
					para completar esta orden sin sobrepagarla.
					{#if pendingBenefitSuggestion.overpayment > 0.01}
						El monto actual excede ese pago neto por
						{formatPrice(pendingBenefitSuggestion.overpayment)}.
					{/if}
				</p>
			{/if}
			<label class="block space-y-2">
				<span class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Monto del beneficio USD
				</span>
				<input
					bind:value={benefitAmountInput}
					type="number"
					min="0"
					step="0.01"
					class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 font-mono text-sm text-on-surface focus:border-brand-blue focus:outline-none"
				/>
			</label>
			<label class="block space-y-2">
				<span class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Nota opcional
				</span>
				<textarea
					bind:value={benefitNoteInput}
					rows="3"
					class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
					placeholder="Ej. Proveedor aplicó redondeo o dejó crédito para próxima compra"></textarea>
			</label>
			<p class="rounded-xl bg-info-container/40 px-3 py-2 text-xs text-on-surface-variant">
				Aplicar a esta PO reduce el saldo y entra en reportes. Solo anotarlo guarda la decisión sin
				impacto financiero.
			</p>
		</div>
	{/snippet}
</ConfirmModal>
