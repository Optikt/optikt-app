<script lang="ts">
	import {
		BadgeDollarSign,
		Ban,
		Building2,
		CreditCard,
		Smartphone,
		WalletCards
	} from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import { toast } from 'svelte-sonner';
	import { ConfirmModal } from '$lib/components/ui';
	import { voidPayment } from '$lib/remote/sales.remote';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { getPaymentMethodLabel, PaymentMethod } from '$lib/shared/enums';
	import type { SalePayment } from '$lib/server/db/schema';

	interface Props {
		payments: SalePayment[];
		saleId: string;
		allowVoid?: boolean;
		onPaymentVoided?: (paidAmount: number) => void;
	}

	let { payments, saleId, allowVoid = true, onPaymentVoided }: Props = $props();

	let showVoidModal = $state(false);
	let voidingPayment = $state<SalePayment | null>(null);
	let voidLoading = $state(false);

	function openVoid(payment: SalePayment) {
		voidingPayment = payment;
		showVoidModal = true;
	}

	async function handleVoid() {
		if (!voidingPayment) return;
		voidLoading = true;
		try {
			const result = await voidPayment({ id: voidingPayment.id, saleId });
			if (!result.success) {
				toast.error(result.error ?? 'Error anulando pago');
				return;
			}
			toast.success('Pago anulado');
			showVoidModal = false;
			voidingPayment = null;
			onPaymentVoided?.(result.paidAmount);
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error anulando pago'));
		} finally {
			voidLoading = false;
		}
	}

	function formatOriginalAmount(payment: SalePayment): string {
		const formatted = payment.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 });

		switch (payment.paymentMethod) {
			case PaymentMethod.EFECTIVO_USD:
				return `$${formatted}`;
			case PaymentMethod.BINANCE_USDT:
				return `${formatted} USDT`;
			default:
				return `${formatted} Bs`;
		}
	}

	function paymentMethodTone(method: string): string {
		switch (method) {
			case PaymentMethod.PAGO_MOVIL_BS:
				return 'bg-info-container text-on-info-container';
			case PaymentMethod.TRANSFERENCIA_BS:
				return 'bg-brand-navy/10 text-brand-navy';
			case PaymentMethod.PUNTO_VENTA_BS:
				return 'bg-purple-container text-on-purple-container';
			case PaymentMethod.EFECTIVO_BS:
				return 'bg-warning-container text-on-warning-container';
			case PaymentMethod.EFECTIVO_USD:
				return 'bg-success-container text-on-success-container';
			case PaymentMethod.BINANCE_USDT:
				return 'bg-surface-container-highest text-brand-navy';
			default:
				return 'bg-surface-container-high text-on-surface-variant';
		}
	}

	function referenceText(payment: SalePayment): string {
		if (payment.voidedAt) {
			return payment.notes?.trim() ? `Anulado: ${payment.notes}` : 'Pago anulado';
		}

		return payment.reference?.trim() || payment.notes?.trim() || '—';
	}
</script>

{#if payments.length === 0}
	<div
		class="rounded-[1.5rem] bg-surface-container-low px-6 py-10 text-center text-base text-slate-400"
	>
		No hay pagos registrados
	</div>
{:else}
	<div class="overflow-hidden rounded-[1.5rem] bg-surface-container-low">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[760px] text-sm">
				<thead class="bg-surface-container-high text-left">
					<tr>
						<th
							class="px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Fecha</th
						>
						<th
							class="px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Método</th
						>
						<th
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Monto original</th
						>
						<th
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Tasa</th
						>
						<th
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Monto USD</th
						>
						<th
							class="px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>Referencia</th
						>
						{#if allowVoid}
							<th class="w-16 px-6 py-4"></th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-surface-container-high" use:autoAnimate>
					{#each payments as payment (payment.id)}
						<tr
							class:opacity-65={payment.voidedAt}
							class="bg-surface-container-lowest transition-colors hover:bg-surface-container-lowest/80"
						>
							<td class="px-6 py-5 align-top">
								<div class:line-through={payment.voidedAt} class="font-medium text-brand-navy">
									{formatDate(payment.paymentDate, { dateStyle: 'short' })}
								</div>
								<div class="mt-1 text-xs text-outline">
									Reg. {formatDate(payment.createdAt, { hour: '2-digit', minute: '2-digit' })}
								</div>
							</td>
							<td class="px-6 py-5 align-top">
								<div class="flex items-center gap-3">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl {paymentMethodTone(
											payment.paymentMethod
										)}"
									>
										{#if payment.paymentMethod === PaymentMethod.PAGO_MOVIL_BS}
											<Smartphone class="h-4 w-4" />
										{:else if payment.paymentMethod === PaymentMethod.TRANSFERENCIA_BS}
											<Building2 class="h-4 w-4" />
										{:else if payment.paymentMethod === PaymentMethod.PUNTO_VENTA_BS}
											<CreditCard class="h-4 w-4" />
										{:else if payment.paymentMethod === PaymentMethod.BINANCE_USDT}
											<BadgeDollarSign class="h-4 w-4" />
										{:else}
											<WalletCards class="h-4 w-4" />
										{/if}
									</div>
									<div>
										<div
											class:line-through={payment.voidedAt}
											class="font-semibold text-on-surface"
										>
											{getPaymentMethodLabel(payment.paymentMethod)}
										</div>
										{#if payment.voidedAt}
											<div
												class="mt-1 text-xs font-semibold tracking-[0.14em] text-on-error-container uppercase"
											>
												Pago anulado
											</div>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-6 py-5 text-right align-top font-mono text-sm text-on-surface-variant">
								<span class:line-through={payment.voidedAt}>{formatOriginalAmount(payment)}</span>
							</td>
							<td class="px-6 py-5 text-right align-top font-mono text-sm text-outline">
								{#if payment.exchangeRate}
									<div>{payment.exchangeRate.toFixed(2)}</div>
								{/if}
								<div>BCV {payment.bcvRate.toFixed(2)}</div>
							</td>
							<td
								class="px-6 py-5 text-right align-top font-mono text-base font-semibold text-brand-navy"
							>
								<span class:line-through={payment.voidedAt}
									>{formatPrice(payment.amountBcvUsd)}</span
								>
							</td>
							<td class="px-6 py-5 align-top text-sm text-outline">
								<span class:italic={payment.voidedAt}>
									{referenceText(payment)}
								</span>
							</td>
							{#if allowVoid}
								<td class="px-6 py-5 text-right align-top">
									{#if !payment.voidedAt}
										<button
											type="button"
											onclick={() => openVoid(payment)}
											class="rounded-full bg-error-container/70 p-2 text-on-error-container transition-colors hover:bg-error-container"
											title="Anular pago"
										>
											<Ban class="h-4 w-4" />
										</button>
									{:else}
										<span class="inline-block h-9 w-9"></span>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

<ConfirmModal
	bind:open={showVoidModal}
	title="Anular Pago"
	message={`¿Está seguro que desea anular este pago de ${voidingPayment ? formatPrice(voidingPayment.amountBcvUsd) : ''}?`}
	confirmLabel="Anular"
	confirmColor="red"
	loading={voidLoading}
	onConfirm={handleVoid}
	onCancel={() => (showVoidModal = false)}
/>
