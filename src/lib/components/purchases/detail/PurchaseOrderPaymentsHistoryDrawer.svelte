<script lang="ts">
	import { Ban, ReceiptText, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { AppBadge, ConfirmModal, SlideOver } from '$lib/components/ui';
	import { voidPurchaseOrderPaymentCmd } from '$lib/remote/purchaseOrders.remote';
	import {
		PURCHASE_PAYMENT_METHOD_LABELS,
		CurrencyCode,
		PurchaseOrderStatus,
		PurchasePaymentMethod
	} from '$lib/shared/enums';
	import { getCurrencySymbol } from '$lib/shared/enums';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';
	import type { PurchaseOrderEarlyPaymentBenefit } from '$lib/server/db/schema';
	import type { PurchaseOrderPaymentWithUsers } from '$lib/server/db/queries/purchaseOrderPayments';
	import { formatDateOnly, formatPrice, getErrorMessage } from '$lib/utils';

	interface Props {
		open: boolean;
		onclose: () => void;
		purchaseOrderId: string;
		status: string;
		payments: PurchaseOrderPaymentWithUsers[];
		earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefit[];
		settlementCurrency?: string;
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
		payments,
		earlyPaymentBenefits,
		settlementCurrency,
		onFinanceChanged
	}: Props = $props();

	let showVoidModal = $state(false);
	let voidingPayment = $state<PurchaseOrderPaymentWithUsers | null>(null);
	let voidLoading = $state(false);

	const canVoidPayment = $derived(status === PurchaseOrderStatus.CONFIRMED);
	const isNativeSettlement = $derived(
		settlementCurrency != null && settlementCurrency !== CurrencyCode.USD_BCV
	);
	const settlementSymbol = $derived(
		isNativeSettlement ? getCurrencySymbol(settlementCurrency!) : ''
	);
	const sortedPayments = $derived.by(() =>
		[...payments].sort((left, right) => left.paymentNumber - right.paymentNumber)
	);
	const totalPaidUsdBcv = $derived(
		sortedPayments
			.filter((payment) => !payment.voidedAt)
			.reduce((sum, p) => sum + p.amountUsdBcv, 0)
	);

	function benefitForPayment(paymentId: string): PurchaseOrderEarlyPaymentBenefit | null {
		return (
			earlyPaymentBenefits.find(
				(benefit) => benefit.paymentId === paymentId && !benefit.voidedAt
			) ?? null
		);
	}

	function formatOriginalAmount(payment: PurchaseOrderPaymentWithUsers): string {
		const formatted = payment.amount.toLocaleString('es-VE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		switch (payment.currencyCode) {
			case CurrencyCode.EUR_BCV:
				return `€${formatted}`;
			case CurrencyCode.USDT:
				return `${formatted} USDT`;
			case CurrencyCode.VES:
				return `Bs. ${formatted}`;
			case CurrencyCode.OTHER:
				return formatted;
			default:
				return `$${formatted}`;
		}
	}

	function paymentVariance(payment: {
		amountAppliedToDebt?: number | null;
		amountAppliedToDebtUsdBcvAtOrder?: number | null;
		amountUsdBcv: number;
	}): number {
		if (!isNativeSettlement) return 0;
		const appliedBcv = Number(
			payment.amountAppliedToDebtUsdBcvAtOrder ?? payment.amountUsdBcv ?? 0
		);
		const actualBcv = Number(payment.amountUsdBcv ?? 0);
		return Math.round((appliedBcv - actualBcv) * 100) / 100;
	}

	function openVoid(payment: PurchaseOrderPaymentWithUsers) {
		voidingPayment = payment;
		showVoidModal = true;
	}

	async function handleVoidPayment() {
		if (!voidingPayment) return;
		voidLoading = true;
		try {
			const result = await voidPurchaseOrderPaymentCmd({
				id: voidingPayment.id,
				purchaseOrderId
			});
			if (!result.success) {
				toast.error(result.error ?? 'Error anulando pago');
				return;
			}
			onFinanceChanged?.({
				payments: result.payments,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			});
			toast.success('Pago anulado');
			showVoidModal = false;
			voidingPayment = null;
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error anulando pago'));
		} finally {
			voidLoading = false;
		}
	}
</script>

<SlideOver {open} {onclose} size="xl">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
				>
					<ReceiptText class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-lg font-semibold text-brand-navy">Historial de pagos</h2>
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

	{#if sortedPayments.length === 0}
		<div class="py-10 text-center">
			<p class="text-sm font-semibold text-on-surface-variant">No hay pagos registrados todavía.</p>
			<p class="mt-1 text-sm text-outline">
				Los pagos que cargues se normalizan siempre a USD BCV.
			</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead
					class="bg-surface-container-low/40 text-[11px] tracking-[0.18em] text-outline uppercase"
				>
					<tr>
						<th class="px-2 py-2">Pago</th>
						<th class="px-2 py-2">Fecha</th>
						<th class="px-2 py-2">Por</th>
						<th class="px-2 py-2">Método</th>
						<th class="px-2 py-2 text-right">Monto</th>
						<th class="px-2 py-2 text-right">USD BCV</th>
						{#if isNativeSettlement}
							<th class="px-2 py-2 text-right">Abono {settlementSymbol}</th>
							<th class="px-2 py-2 text-right">Var.</th>
						{/if}
						<th class="px-2 py-2">Detalle</th>
						<th class="w-12 px-2 py-2"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-outline-variant/15">
					{#each sortedPayments as payment (payment.id)}
						{@const earlyBenefit = benefitForPayment(payment.id)}
						<tr class:opacity-60={payment.voidedAt}>
							<td class="px-2 py-2 align-top">
								<div class="font-semibold text-brand-navy">#{payment.paymentNumber}</div>
								{#if payment.voidedAt}
									<p class="mt-1 text-[10px] font-semibold tracking-[0.14em] text-error uppercase">
										Anulado
									</p>
								{/if}
							</td>
							<td class="px-2 py-2 align-top text-xs text-on-surface-variant">
								<div class:line-through={payment.voidedAt}>
									{formatDateOnly(payment.paymentDate, { dateStyle: 'short' })}
								</div>
							</td>
							<td class="px-2 py-2 align-top text-xs text-on-surface-variant">
								<div>{payment.createdByName}</div>
								{#if payment.voidedAt && payment.voidedByName}
									<div class="mt-1 text-[10px] text-error">↳ {payment.voidedByName}</div>
								{/if}
							</td>
							<td class="px-2 py-2 align-top">
								<AppBadge variant="neutral" class="text-[10px]"
									>{PURCHASE_PAYMENT_METHOD_LABELS[
										payment.paymentMethod as PurchasePaymentMethod
									] ?? payment.paymentMethod}</AppBadge
								>
							</td>
							<td
								class="px-2 py-2 text-right align-top font-mono text-on-surface-variant tabular-nums"
							>
								<span class:line-through={payment.voidedAt}>{formatOriginalAmount(payment)}</span>
							</td>
							<td
								class="px-2 py-2 text-right align-top font-mono font-semibold text-brand-navy tabular-nums"
							>
								<span class:line-through={payment.voidedAt}
									>{formatPrice(payment.amountUsdBcv)}</span
								>
							</td>
							{#if isNativeSettlement}
								{@const pvar = paymentVariance(payment)}
								<td
									class="px-2 py-2 text-right align-top font-mono tabular-nums {pvar > 0
										? 'text-success'
										: pvar < 0
											? 'text-error'
											: 'text-on-surface-variant'}"
								>
									<span class:line-through={payment.voidedAt}>
										{(payment.amountAppliedToDebt ?? payment.amountUsdBcv ?? 0).toFixed(2)}
									</span>
								</td>
								<td
									class="px-2 py-2 text-right align-top font-mono tabular-nums {pvar > 0
										? 'text-success'
										: pvar < 0
											? 'text-error'
											: 'text-on-surface-variant'}"
								>
									<span class:line-through={payment.voidedAt}>
										{pvar > 0 ? '+' : ''}{pvar.toFixed(2)}
									</span>
								</td>
							{/if}
							<td class="px-2 py-2 align-top text-xs text-on-surface-variant">
								<p
									class="max-w-[8rem] truncate whitespace-pre-wrap"
									title={payment.reference || payment.notes || '—'}
								>
									{payment.reference || payment.notes || '—'}
								</p>
								{#if earlyBenefit}
									<div
										class="mt-1 rounded-lg bg-info-container/40 px-2 py-1 text-[10px] text-on-surface"
									>
										<span class="font-semibold">Pronto pago</span> · {formatPrice(
											earlyBenefit.amountUsdBcv
										)}
									</div>
								{/if}
							</td>
							<td class="px-2 py-2 text-right align-top">
								{#if canVoidPayment && !payment.voidedAt}
									<button
										type="button"
										onclick={() => openVoid(payment)}
										class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-error-container/65 text-on-error-container transition-colors hover:bg-error-container"
										title="Anular pago"
									>
										<Ban class="h-3.5 w-3.5" />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div
			class="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/15 px-6 py-4"
		>
			<p class="text-xs text-on-surface-variant">Suma de pagos no anulados</p>
			<p class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
				{formatPrice(totalPaidUsdBcv)}
			</p>
		</div>
	{/if}
</SlideOver>

<ConfirmModal
	bind:open={showVoidModal}
	title="Anular pago"
	message={voidingPayment
		? `¿Seguro que deseas anular el pago #${voidingPayment.paymentNumber} por ${formatPrice(voidingPayment.amountUsdBcv)}?`
		: ''}
	confirmLabel="Anular"
	confirmColor="red"
	loading={voidLoading}
	onConfirm={handleVoidPayment}
	onCancel={() => {
		showVoidModal = false;
		voidingPayment = null;
	}}
/>
