<script lang="ts">
	import { Ban } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ConfirmModal } from '$lib/components/ui';
	import { voidPayment } from '$lib/remote/sales.remote';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { getPaymentMethodLabel } from '$lib/shared/enums';
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

	const activePayments = $derived(payments.filter((p) => !p.voidedAt));
	const voidedPayments = $derived(payments.filter((p) => p.voidedAt));
</script>

{#if payments.length === 0}
	<p class="py-6 text-center text-base text-slate-400">No hay pagos registrados</p>
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200">
		<table class="w-full text-sm">
			<thead class="bg-slate-50">
				<tr>
					<th class="px-4 py-3 text-left text-sm font-semibold text-slate-600">Fecha</th>
					<th class="px-4 py-3 text-left text-sm font-semibold text-slate-600">Método</th>
					<th class="px-4 py-3 text-right text-sm font-semibold text-slate-600">Monto</th>
					<th class="px-4 py-3 text-right text-sm font-semibold text-slate-600">Tasa</th>
					<th class="px-4 py-3 text-right text-sm font-semibold text-slate-600">USD BCV</th>
					<th class="px-4 py-3 text-left text-sm font-semibold text-slate-600">Ref.</th>
					{#if allowVoid}
						<th class="px-4 py-3 text-sm font-semibold text-slate-600"></th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each activePayments as payment (payment.id)}
					<tr class="border-t border-slate-100 transition-colors hover:bg-slate-50/50">
						<td class="px-4 py-3 text-sm text-slate-600">
							{formatDate(payment.paymentDate ?? payment.createdAt, { month: 'short' })}
						</td>
						<td class="px-4 py-3 text-sm font-medium text-slate-800">
							{getPaymentMethodLabel(payment.paymentMethod)}
						</td>
						<td class="px-4 py-3 text-right font-mono text-sm text-slate-700">
							{payment.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
						</td>
						<td class="px-4 py-3 text-right font-mono text-sm text-slate-500">
							{#if payment.exchangeRate}
								{payment.exchangeRate.toFixed(2)} /
							{/if}
							BCV {payment.bcvRate.toFixed(2)}
						</td>
						<td class="px-4 py-3 text-right font-mono text-sm font-semibold text-blue-700">
							{formatPrice(payment.amountBcvUsd)}
						</td>
						<td class="px-4 py-3 text-sm text-slate-500">
							{payment.reference ?? '—'}
						</td>
						{#if allowVoid}
							<td class="px-4 py-3 text-right">
								<button
									onclick={() => openVoid(payment)}
									class="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
									title="Anular pago"
								>
									<Ban class="h-4 w-4" />
								</button>
							</td>
						{/if}
					</tr>
				{/each}

				{#each voidedPayments as payment (payment.id)}
					<tr class="border-t border-slate-100 bg-red-50/30 opacity-60">
						<td class="px-4 py-3 text-sm text-slate-400 line-through">
							{formatDate(payment.paymentDate ?? payment.createdAt, { month: 'short' })}
						</td>
						<td class="px-4 py-3 text-sm text-slate-400 line-through">
							{getPaymentMethodLabel(payment.paymentMethod)}
						</td>
						<td class="px-4 py-3 text-right font-mono text-sm text-slate-400 line-through">
							{payment.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
						</td>
						<td class="px-4 py-3 text-right font-mono text-sm text-slate-400">—</td>
						<td class="px-4 py-3 text-right font-mono text-sm text-slate-400 line-through">
							{formatPrice(payment.amountBcvUsd)}
						</td>
						<td class="px-4 py-3 text-sm font-medium text-red-400">Anulado</td>
						{#if allowVoid}
							<td class="px-4 py-3"></td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
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
