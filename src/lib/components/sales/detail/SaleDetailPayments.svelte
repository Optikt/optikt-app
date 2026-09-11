<script lang="ts">
	import { PaymentMethod, PAYMENT_METHOD_LABELS, isBsPaymentMethod } from '$lib/shared/enums';
	import { formatDateOnly, formatPrice } from '$lib/utils';
	import type { SalePayment } from '$lib/server/db/schema';

	interface Props {
		payments: SalePayment[];
	}

	let { payments }: Props = $props();
</script>

<div class="mt-3 flex min-h-0 flex-1 flex-col border-t border-outline-variant/50 pt-3">
	<p class="mb-2 text-sm font-semibold text-on-surface-variant">Abonos Registrados</p>
	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if payments.length > 0}
			<div class="space-y-2">
				{#each payments as payment (payment.id)}
					<div
						class="rounded-[var(--ds-radius-lg)] border border-outline-variant bg-surface-container-low p-3"
					>
						<div class="flex items-baseline justify-between">
							<span class="text-sm font-semibold text-on-surface">
								{formatDateOnly(payment.paymentDate, { dateStyle: 'medium' })} -
								{PAYMENT_METHOD_LABELS[payment.paymentMethod as unknown as PaymentMethod]}
								{#if payment.reference}
									<span class="text-xs text-outline">(Ref. {payment.reference})</span>
								{/if}
							</span>
							<span class="text-sm font-bold text-on-surface">
								{formatPrice(payment.amountBcvUsd)}
							</span>
						</div>
						<div class="mt-1 flex items-baseline justify-between">
							{#if isBsPaymentMethod(payment.paymentMethod as unknown as PaymentMethod)}
								<span class="font-mono text-xs text-outline"
									>Tasa BCV: {Number(payment.bcvRate).toFixed(2)}</span
								>
								<span class="text-xs font-semibold text-on-surface-variant"
									>Bs. {Number(payment.amount).toLocaleString('es-VE', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									})}</span
								>
							{:else if (payment.paymentMethod as unknown as PaymentMethod) === PaymentMethod.BINANCE_USDT}
								<span class="font-mono text-xs text-outline"
									>Tasa USDT: {Number(payment.exchangeRate ?? 0).toFixed(2)}</span
								>
								<span class="text-xs font-semibold text-on-surface-variant"
									>USDT {Number(payment.amount).toLocaleString('es-VE', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									})}</span
								>
							{:else}
								<span class="font-mono text-xs text-outline"
									>Efectivo $ • Tasa BCV: {Number(payment.bcvRate).toFixed(2)}</span
								>
								<span class="text-xs font-semibold text-on-surface-variant"
									>Bs. {Number(payment.amountBcvUsd * payment.bcvRate).toLocaleString('es-VE', {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2
									})}</span
								>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="py-6 text-center text-sm text-outline italic">Aún no hay abonos registrados</p>
		{/if}
	</div>
</div>
