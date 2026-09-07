<script lang="ts">
	import { formatCurrency, formatDateOnly, formatPrice } from '$lib/utils';
	import type { EarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';

	interface PurchaseNormalized {
		amountBs: number;
	}

	interface Props {
		kind: 'sale' | 'purchase';
		methodLabel: string;
		pendingAfterPayment: number;
		restLabelClass: string;
		showPurchasePreview: boolean;
		purchaseNormalized: PurchaseNormalized;
		resolvedAmountUsd: number;
		resolvedUsdDisplay: string;
		isNativeSettlement: boolean;
		amountAppliedToDebt: number | undefined;
		settlementSymbol: string;
		exchangeVariance: number;
		liveEarlyPaymentSuggestion: EarlyPaymentDiscountSuggestion | null;
	}

	let {
		kind,
		methodLabel,
		pendingAfterPayment,
		restLabelClass,
		showPurchasePreview,
		purchaseNormalized,
		resolvedAmountUsd,
		resolvedUsdDisplay,
		isNativeSettlement,
		amountAppliedToDebt,
		settlementSymbol,
		exchangeVariance,
		liveEarlyPaymentSuggestion
	}: Props = $props();
</script>

{#if kind === 'sale'}
	<div class="flex items-center justify-between rounded-lg bg-surface-container-high/70 px-3 py-2">
		<div>
			<p class="text-[10px] text-on-surface-variant">Restará luego</p>
			<p class="font-mono text-sm font-bold tabular-nums {restLabelClass}">
				{formatPrice(pendingAfterPayment)}
			</p>
		</div>
		<div class="text-right">
			<p class="text-[10px] text-on-surface-variant">Método</p>
			<p class="text-xs font-semibold text-on-surface">
				{methodLabel}
			</p>
		</div>
	</div>
{:else if showPurchasePreview}
	<div
		class="rounded-lg bg-surface-container-high px-3 py-2.5 font-mono text-xs {isNativeSettlement &&
		amountAppliedToDebt != null &&
		amountAppliedToDebt > 0
			? 'space-y-1'
			: ''}"
	>
		<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
			{#if purchaseNormalized.amountBs > 0}
				<span class="text-on-surface-variant">Bs {formatCurrency(purchaseNormalized.amountBs)}</span
				>
			{/if}
			{#if resolvedAmountUsd > 0}
				<span class="text-outline">·</span>
				<span class="font-semibold text-brand-navy">{resolvedUsdDisplay}</span>
			{/if}
			{#if isNativeSettlement && amountAppliedToDebt != null && amountAppliedToDebt > 0}
				<span class="text-outline">·</span>
				<span class="text-on-surface-variant"
					>Abono {formatCurrency(amountAppliedToDebt)} {settlementSymbol}</span
				>
				<span
					class={exchangeVariance > 0
						? 'text-success'
						: exchangeVariance < 0
							? 'text-error'
							: 'text-on-surface-variant'}
				>
					· {exchangeVariance > 0 ? '+' : ''}{formatPrice(exchangeVariance)}
				</span>
			{/if}
		</div>
		{#if liveEarlyPaymentSuggestion}
			<div class="mt-1 flex items-center gap-1.5 text-[10px] text-brand-gold">
				<span class="font-semibold">Pronto pago</span>
				<span
					>· {formatDateOnly(liveEarlyPaymentSuggestion.deadline, {
						dateStyle: 'short'
					})} · {formatPrice(liveEarlyPaymentSuggestion.amount)}</span
				>
			</div>
		{/if}
	</div>
{/if}
