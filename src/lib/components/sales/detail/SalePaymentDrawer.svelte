<script lang="ts">
	import { ReceiptText, X } from '@lucide/svelte';
	import { AppBadge, SlideOver } from '$lib/components/ui';
	import { PaymentForm } from '$lib/components/sales';
	import { formatPrice } from '$lib/utils';

	interface Props {
		open: boolean;
		saleId: string;
		remainingBcvUsd: number;
		bcvRate: number;
		isCasheaSale: boolean;
		paidAmountBcvUsd: number;
		drawerResetKey: number;
		onPaymentAdded: (newPaidAmount: number) => void;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		saleId,
		remainingBcvUsd,
		bcvRate,
		isCasheaSale,
		paidAmountBcvUsd,
		drawerResetKey,
		onPaymentAdded,
		onClose
	}: Props = $props();
</script>

<SlideOver bind:open onclose={onClose} size="md">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
				>
					<ReceiptText class="h-5 w-5" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h2 class="text-lg font-semibold text-brand-navy">Registrar pago</h2>
						{#if remainingBcvUsd > 0.01}
							<AppBadge variant="info">Saldo: {formatPrice(remainingBcvUsd)}</AppBadge>
						{:else}
							<AppBadge variant="success">Pagado</AppBadge>
						{/if}
					</div>
					<p class="text-xs text-on-surface-variant">
						{paidAmountBcvUsd != null && paidAmountBcvUsd > 0
							? 'Pagos registrados'
							: 'Sin pagos registrados'}
					</p>
				</div>
			</div>
			<button
				type="button"
				onclick={onclose}
				class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
				aria-label="Cerrar"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div class="space-y-4 px-6">
		<PaymentForm
			kind="sale"
			{saleId}
			{remainingBcvUsd}
			{bcvRate}
			{isCasheaSale}
			variant="drawer"
			{drawerResetKey}
			{onPaymentAdded}
		/>
	</div>
</SlideOver>
