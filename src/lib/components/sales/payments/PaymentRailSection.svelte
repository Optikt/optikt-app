<script lang="ts">
	import { PAYMENT_METHOD_LABELS, PaymentMethod, isBsPaymentMethod } from '$lib/shared/enums';
	import { PaymentAmountCard, PaymentPreviewCard } from '$lib/components/payments';
	import { PaymentReferenceField } from '$lib/components/ui';
	import CasheaCheckbox from '../CasheaCheckbox.svelte';
	import type { EarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';
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
		isNativeSettlement: boolean;
		amountAppliedToDebt?: number;
		settlementSymbol: string;
		exchangeVariance: number;
		liveEarlyPaymentSuggestion: EarlyPaymentDiscountSuggestion | null;
		canSubmit: boolean;
		drawerSubmitLabel: string;
		submitLabel: string;
		onDateInput: (value: string) => void;
		onUsdInput: (event: Event) => void;
		onNativeInput: (event: Event) => void;
		onBcvRateInput: (value: string) => void;
		onSpecificRateInput: (value: string) => void;
		onUseRemainingBalance: () => void;
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
		isNativeSettlement,
		amountAppliedToDebt,
		settlementSymbol,
		exchangeVariance,
		liveEarlyPaymentSuggestion,
		canSubmit,
		drawerSubmitLabel,
		submitLabel,
		onDateInput,
		onUsdInput,
		onNativeInput,
		onBcvRateInput,
		onSpecificRateInput,
		onUseRemainingBalance,
		onReference,
		onNotes,
		onSubmit
	}: Props = $props();
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
