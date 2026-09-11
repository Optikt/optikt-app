<script lang="ts">
	import { formatPrice } from '$lib/utils';

	interface Props {
		subtotal: number;
		discount: number;
		discountType: string;
		globalDiscountAmount: number;
		taxRate: number;
		taxAmount: number;
		total: number;
		remainingBcvUsd: number;
		paidAmountBcvUsd: number;
		paymentProgressPercent: number;
		showPaymentForm: boolean;
		onPay: () => void;
	}

	let {
		subtotal,
		discount,
		discountType,
		globalDiscountAmount,
		taxRate,
		taxAmount,
		total,
		remainingBcvUsd,
		paidAmountBcvUsd,
		paymentProgressPercent,
		showPaymentForm,
		onPay
	}: Props = $props();
</script>

<div
	class="flex max-h-[calc(100vh-6rem)] flex-col rounded-[var(--ds-radius-xl)] border border-outline-variant/50 bg-surface-container-lowest p-5 shadow-[var(--ds-shadow-md)]"
>
	<div class="flex-shrink-0 space-y-3">
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-xs text-outline">Subtotal</span>
				<span class="text-xs font-semibold text-on-surface">{formatPrice(subtotal)}</span>
			</div>
			{#if globalDiscountAmount > 0.01}
				<div class="flex items-center justify-between">
					<span class="text-xs text-outline"
						>Descuento {#if discountType === 'PERCENTAGE'}({discount}%){/if}</span
					>
					<span class="text-xs font-semibold text-red-600"
						>-{formatPrice(globalDiscountAmount)}</span
					>
				</div>
			{/if}
			<div class="flex items-center justify-between">
				<span class="text-xs text-outline">IVA ({taxRate}%)</span>
				<span class="text-xs font-semibold text-on-surface">{formatPrice(taxAmount)}</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold text-on-surface">Total</span>
				<span class="text-xs font-bold text-on-surface">{formatPrice(total)}</span>
			</div>
		</div>

		<div>
			{#if remainingBcvUsd > 0.01}
				<p class="text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
					Saldo Pendiente
				</p>
				<p class="mt-1 text-3xl font-extrabold text-brand-gold-dark">
					{formatPrice(remainingBcvUsd)}
				</p>
				<div class="mt-3 h-1.5 rounded-full bg-amber-100">
					<div
						class="h-full rounded-full bg-amber-400"
						style={`width: ${paymentProgressPercent}%`}
					></div>
				</div>
				<div class="mt-1 flex items-center justify-between text-[11px] text-amber-600">
					<span>{formatPrice(paidAmountBcvUsd)} cubierto</span>
					<span>{paymentProgressPercent.toFixed(0)}%</span>
				</div>
			{:else}
				<p class="text-3xl font-extrabold text-success">Pagado</p>
			{/if}
		</div>

		{#if showPaymentForm}
			<button
				type="button"
				onclick={onPay}
				class="w-full cursor-pointer rounded-[var(--ds-radius-lg)] bg-brand-blue px-5 py-3.5 text-sm font-bold text-on-primary shadow-[var(--ds-shadow-md)] transition-colors hover:bg-brand-blue-dark"
			>
				Cobrar / Registrar Pago
			</button>
		{/if}
	</div>
</div>
