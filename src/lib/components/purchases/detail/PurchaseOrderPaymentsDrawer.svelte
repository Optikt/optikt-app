<script lang="ts">
	import { ReceiptText, X } from '@lucide/svelte';
	import { AppBadge, SlideOver } from '$lib/components/ui';
	import PaymentForm, {
		type PaymentComposerRequest
	} from '$lib/components/sales/PaymentForm.svelte';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';
	import type { PurchaseOrder, PurchaseOrderEarlyPaymentBenefit } from '$lib/server/db/schema';
	import type { PurchaseOrderPaymentWithUsers } from '$lib/server/db/queries/purchaseOrderPayments';
	import { formatPrice } from '$lib/utils';

	interface Props {
		open: boolean;
		onclose: () => void;
		purchaseOrderId: string;
		status: string;
		defaultBcvRate: number;
		payments: PurchaseOrderPaymentWithUsers[];
		purchaseOrder: PurchaseOrder;
		earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefit[];
		pendingBalanceUsd?: number;
		debtTotalUsd?: number;
		isFullyPaid?: boolean;
		settlementCurrency?: string;
		composerRequest?: PaymentComposerRequest | null;
		onFinanceChanged?: (payload: {
			payments: PurchaseOrderPaymentWithUsers[];
			earlyPaymentBenefits?: PurchaseOrderEarlyPaymentBenefit[];
			balance: PurchaseOrderBalanceSummary;
			dueStatus: PurchaseOrderDueStatus;
		}) => void;
	}

	let {
		open,
		onclose,
		purchaseOrderId,
		status,
		defaultBcvRate,
		payments,
		purchaseOrder,
		earlyPaymentBenefits,
		pendingBalanceUsd,
		debtTotalUsd,
		isFullyPaid = false,
		settlementCurrency,
		composerRequest = null,
		onFinanceChanged
	}: Props = $props();

	let drawerResetCount = $state(0);
</script>

<SlideOver
	{open}
	onclose={() => {
		drawerResetCount++;
		onclose();
	}}
	size="md"
>
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
						{#if pendingBalanceUsd != null}
							<AppBadge variant="info">Saldo: {formatPrice(pendingBalanceUsd)}</AppBadge>
						{/if}
					</div>
					<p class="text-xs text-on-surface-variant">
						{payments.length} pago{payments.length !== 1 ? 's' : ''} registrado
						{payments.length !== 1 ? 's' : ''}
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

	<div class="px-6 space-y-4">
		{#if status === 'CONFIRMED' && !isFullyPaid}
			<PaymentForm
				kind="purchase"
				{purchaseOrderId}
				{status}
				{defaultBcvRate}
				{purchaseOrder}
				{payments}
				{earlyPaymentBenefits}
				{pendingBalanceUsd}
				{debtTotalUsd}
				{isFullyPaid}
				{settlementCurrency}
				{composerRequest}
				{onFinanceChanged}
				variant="drawer"
				drawerResetKey={drawerResetCount}
			/>
		{:else if status === 'CONFIRMED' && isFullyPaid}
			<div class="flex items-center justify-center py-8">
				<AppBadge variant="success" class="text-sm">Completamente pagada</AppBadge>
			</div>
		{/if}
	</div>
</SlideOver>
