<script lang="ts">
	import { PAYMENT_METHOD_LABELS, PaymentMethod, isBsPaymentMethod } from '$lib/shared/enums';
	import { PaymentAmountCard, PaymentPreviewCard } from '$lib/components/payments';
	import { PaymentReferenceField } from '$lib/components/ui';
	import CasheaCheckbox from '../CasheaCheckbox.svelte';
	import type { EarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';
	import type { ProntoPagoInfo } from './purchaseOrderProntoPago';
	import { formatDateOnly, formatPrice } from '$lib/utils';
	import type { PaymentFormKind } from './paymentFormDerived';

	interface Props {
		kind: PaymentFormKind;
		rail: PaymentMethod;
		variant: 'default' | 'drawer';
		paymentDate: string;
		usdFieldValue: string;
		nativeFieldValue: string;
		nativeLabel: string;
		nativePrefix: string;
		isNativeSettlement: boolean;
		settlementSymbol: string;
		debtBalanceUsd: number;
		resolvedAmountUsd: number;
		resolvedUsdDisplay: string;
		rateContextLine: string;
		bcvRateInput: string;
		defaultBcvRateInput: string;
		needsSpecificRate: boolean;
		specificRateLabel: string;
		specificRateInput: string;
		autoSpecificRate: number;
		isCasheaSale: boolean;
		reference: string;
		notes: string;
		referenceLabel: string;
		referencePlaceholder: string;
		referenceRequired: boolean;
		referenceHelper?: string;
		overpaymentAmount: number;
		overpaymentDisplay: string;
		pendingAfterPayment: number;
		restLabelClass: string;
		showPurchasePreview: boolean;
		purchaseNormalized: { amountBs: number; amountUsdBcv: number };
		amountAppliedToDebt?: number;
		exchangeVariance: number;
		liveEarlyPaymentSuggestion: EarlyPaymentDiscountSuggestion | null;
		prontoPagoInfo?: ProntoPagoInfo | null;
		canSubmit: boolean;
		drawerSubmitLabel: string;
		submitLabel: string;
		onDateInput: (value: string) => void;
		onUsdInput: (event: Event) => void;
		onNativeInput: (event: Event) => void;
		onBcvRateInput: (value: string) => void;
		onSpecificRateInput: (value: string) => void;
		onUseRemainingBalance: () => void;
		onApplyProntoPago?: () => void;
		onReference: (value: string) => void;
		onNotes: (value: string) => void;
		onSubmit: () => void;
	}

	let {
		kind,
		rail,
		variant,
		paymentDate,
		usdFieldValue,
		nativeFieldValue,
		nativeLabel,
		nativePrefix,
		isNativeSettlement,
		settlementSymbol,
		debtBalanceUsd,
		resolvedAmountUsd,
		resolvedUsdDisplay,
		rateContextLine,
		bcvRateInput,
		defaultBcvRateInput,
		needsSpecificRate,
		specificRateLabel,
		specificRateInput,
		autoSpecificRate,
		isCasheaSale = $bindable(),
		reference,
		notes,
		referenceLabel,
		referencePlaceholder,
		referenceRequired,
		referenceHelper,
		overpaymentAmount,
		overpaymentDisplay,
		pendingAfterPayment,
		restLabelClass,
		showPurchasePreview,
		purchaseNormalized,
		amountAppliedToDebt,
		exchangeVariance,
		liveEarlyPaymentSuggestion,
		prontoPagoInfo = null,
		canSubmit,
		drawerSubmitLabel,
		submitLabel,
		onDateInput,
		onUsdInput,
		onNativeInput,
		onBcvRateInput,
		onSpecificRateInput,
		onUseRemainingBalance,
		onApplyProntoPago,
		onReference,
		onNotes,
		onSubmit
	}: Props = $props();

	function formatProntoPagoAmount(value: number): string {
		return isNativeSettlement ? `${value.toFixed(2)} ${settlementSymbol}` : formatPrice(value);
	}
</script>

<div class="space-y-3">
	<PaymentAmountCard
		{kind}
		{rail}
		{variant}
		{paymentDate}
		{usdFieldValue}
		{nativeFieldValue}
		{nativeLabel}
		{nativePrefix}
		{isNativeSettlement}
		{settlementSymbol}
		{debtBalanceUsd}
		{resolvedAmountUsd}
		{resolvedUsdDisplay}
		{rateContextLine}
		{bcvRateInput}
		{defaultBcvRateInput}
		{needsSpecificRate}
		{specificRateLabel}
		{specificRateInput}
		{autoSpecificRate}
		{onDateInput}
		{onUsdInput}
		{onNativeInput}
		{onBcvRateInput}
		{onSpecificRateInput}
		{onUseRemainingBalance}
	/>

	<!-- Cashea (sale, solo si la venta es Cashea) -->
	{#if kind === 'sale' && isCasheaSale && isBsPaymentMethod(rail)}
		<CasheaCheckbox variant="gold" disabled label="Pago con Cashea" bind:isCashea={isCasheaSale} />
	{/if}

	<!-- Referencia + notas -->
	<PaymentReferenceField
		{reference}
		{notes}
		label={referenceLabel}
		placeholder={referencePlaceholder}
		required={referenceRequired}
		helper={referenceHelper}
		{onReference}
		{onNotes}
	/>

	<!-- Sale: overpayment warning -->
	{#if kind === 'sale' && overpaymentAmount > 0.01}
		<div class="rounded-lg bg-error-container/50 px-3 py-2 text-xs text-on-error-container">
			<p class="font-semibold">El monto supera la deuda.</p>
			<p>Excedente: {overpaymentDisplay}</p>
		</div>
	{/if}

	<!-- Pronto pago: aviso + botón (solo compras) -->
	{#if kind === 'purchase' && prontoPagoInfo}
		{#if prontoPagoInfo.withinWindow}
			<div
				class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-success-container/40 px-3 py-2 text-xs text-on-surface"
			>
				<p>
					<span class="font-semibold">Pronto pago {prontoPagoInfo.percent}%</span>
					· hasta {formatDateOnly(prontoPagoInfo.deadline, { dateStyle: 'short' })}
					· neto sugerido
					<strong>{formatProntoPagoAmount(prontoPagoInfo.recommendedPayment)}</strong>
				</p>
				<button
					type="button"
					onclick={onApplyProntoPago}
					class="shrink-0 rounded-lg bg-brand-navy px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-brand-navy/90"
				>
					Aplicar pronto pago
				</button>
			</div>
		{:else}
			<div class="rounded-lg bg-warning-container/40 px-3 py-2 text-xs text-on-surface">
				<p>
					<span class="font-semibold">Fuera del plazo de pronto pago.</span>
					La fecha de pago ({formatDateOnly(paymentDate, { dateStyle: 'short' })}) es posterior al
					límite ({formatDateOnly(prontoPagoInfo.deadline, { dateStyle: 'short' })}). Si el pago se
					hizo dentro del plazo, corrige la fecha para poder aplicar el
					{prontoPagoInfo.percent}%.
				</p>
			</div>
		{/if}
	{/if}

	<!-- Preview -->
	<PaymentPreviewCard
		{kind}
		methodLabel={PAYMENT_METHOD_LABELS[rail as PaymentMethod]}
		{pendingAfterPayment}
		{restLabelClass}
		{showPurchasePreview}
		{purchaseNormalized}
		{resolvedAmountUsd}
		{resolvedUsdDisplay}
		{isNativeSettlement}
		{amountAppliedToDebt}
		{settlementSymbol}
		{exchangeVariance}
		{liveEarlyPaymentSuggestion}
	/>

	<button
		type="button"
		onclick={onSubmit}
		disabled={!canSubmit}
		class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-brand-navy/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
	>
		{variant === 'drawer' ? drawerSubmitLabel : submitLabel}
	</button>
</div>
