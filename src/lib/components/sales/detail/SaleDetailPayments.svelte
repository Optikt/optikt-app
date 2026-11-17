<script lang="ts">
	import { CreditCard, Ellipsis, History, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ConfirmModal } from '$lib/components/ui';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { voidPayment } from '$lib/remote/sales/payments.remote';
	import { PAYMENT_METHOD_LABELS, PaymentMethod, isBsPaymentMethod } from '$lib/shared/enums';
	import type { SalePaymentWithUsers } from '$lib/server/db/queries/sales/payments';
	import { logger } from '$lib/utils/logger';
	import { formatCurrency, formatDateOnly, formatPrice } from '$lib/utils';
	import { getErrorMessage } from '$lib/utils/errors';

	interface Props {
		/** Includes voided payments (loader) — they render collapsed behind a link. */
		payments: SalePaymentWithUsers[];
		/** Non-viewer role (register + void). */
		canAct: boolean;
		isCancelled: boolean;
		remainingBcvUsd: number;
		/** Opens the payment drawer (page owns the drawer). */
		onRegister: () => void;
		/** Opens the «Pagos de la venta» drawer (mounted at page level, outside the
		 * container — `container-type` containment would offset `fixed` overlays). */
		onViewDetail: () => void;
		/** A void succeeded: the page invalidates + syncs (saldo, barra, estados). */
		onChanged: () => void;
	}

	let {
		payments,
		canAct,
		isCancelled,
		remainingBcvUsd,
		onRegister,
		onViewDetail,
		onChanged
	}: Props = $props();

	const activePayments = $derived(payments.filter((p) => !p.voidedAt));
	const voidedPayments = $derived(payments.filter((p) => p.voidedAt));
	const canRegister = $derived(canAct && !isCancelled && remainingBcvUsd > 0.01);

	let showVoided = $state(false);
	let voidTarget = $state<SalePaymentWithUsers | null>(null);
	let voidOpen = $state(false);
	let voiding = $state(false);
	let voidReason = $state('');
	let voidError = $state<string | null>(null);

	function canVoid(): boolean {
		return canAct && !isCancelled;
	}

	/**
	 * Opens the void modal for a payment. Exported so the page-level history
	 * drawer (which lives outside this card) can trigger the same single flow.
	 */
	export function requestVoid(payment: SalePaymentWithUsers) {
		if (!canVoid()) return;
		voidTarget = payment;
		voidReason = '';
		voidError = null;
		voidOpen = true;
	}

	function openVoidModal(payment: SalePaymentWithUsers) {
		requestVoid(payment);
	}

	function methodLabel(payment: SalePaymentWithUsers): string {
		return PAYMENT_METHOD_LABELS[payment.paymentMethod as unknown as PaymentMethod] ?? 'Pago';
	}

	/** Bs. figure at the payment's own frozen rate (never wraps mid-number). */
	function bsFigure(payment: SalePaymentWithUsers): string {
		const method = payment.paymentMethod as unknown as PaymentMethod;
		const value = isBsPaymentMethod(method)
			? Number(payment.amount)
			: Number(payment.amountBcvUsd) * Number(payment.bcvRate);
		return `Bs. ${formatCurrency(value)}`;
	}

	async function confirmVoid() {
		if (!voidTarget || voiding) return;
		const reason = voidReason.trim();
		if (!reason) {
			voidError = 'El motivo es obligatorio para anular el pago';
			return;
		}
		voidError = null;
		voiding = true;
		try {
			const result = await voidPayment({ id: voidTarget.id, saleId: voidTarget.saleId, reason });
			if (result.success) {
				toast.success('Pago anulado: el saldo se actualizó');
				voidOpen = false;
				voidTarget = null;
				voidReason = '';
				onChanged();
			} else {
				voidError = result.error;
				toast.error(result.error);
			}
		} catch (error) {
			logger.error('Error anulando el pago', error);
			voidError = getErrorMessage(error, 'No se pudo anular el pago');
			toast.error(voidError);
		} finally {
			voiding = false;
		}
	}
</script>

<section
	class="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm"
>
	<div class="flex flex-wrap items-center gap-2 px-4 pt-3.5 pb-2.5">
		<h2 class="font-heading text-[15px] font-bold text-brand-navy">Pagos</h2>
		<span class="rounded bg-brand-navy px-[7px] text-[12px] font-bold text-white tabular-nums">
			{activePayments.length}
		</span>
		<span class="flex-1"></span>
		<button
			type="button"
			onclick={onViewDetail}
			class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-outline-variant bg-white px-2.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
		>
			<History class="h-3.5 w-3.5" />
			Ver detalle
		</button>
		{#if canRegister}
			<button
				type="button"
				onclick={onRegister}
				class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-outline-variant bg-white px-2.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
			>
				<Plus class="h-3.5 w-3.5" />
				Registrar
			</button>
		{/if}
	</div>

	{#if activePayments.length === 0}
		{#if voidedPayments.length === 0}
			<p class="px-4 py-7 text-center text-[13px] text-outline italic">
				Aún no hay abonos registrados
			</p>
		{:else}
			<p class="px-4 pb-3 text-center text-[13px] text-outline italic">
				Todos los abonos fueron anulados
			</p>
		{/if}
	{:else}
		<div class="border-t border-outline-variant/60">
			{#each activePayments as payment (payment.id)}
				<div class="grid grid-cols-[32px_1fr_auto_26px] items-start gap-3 px-4 py-2.5">
					<span
						class="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-lg bg-surface-container-high text-brand-navy"
					>
						<CreditCard class="h-4 w-4" />
					</span>
					<div class="min-w-0 pt-0.5">
						<p
							class="text-[13px] font-semibold [overflow-wrap:anywhere] break-words text-on-surface"
						>
							{methodLabel(payment)}
						</p>
						<p class="text-xs [overflow-wrap:anywhere] break-words text-on-surface-variant">
							{formatDateOnly(payment.paymentDate, { dateStyle: 'medium' })}
							{#if payment.reference}&nbsp;· Ref. {payment.reference}{/if}
						</p>
						{#snippet rateTip({ props }: { props: Record<string, unknown> })}
							<span
								{...props}
								class="mt-0.5 block cursor-help font-mono text-[11px] whitespace-nowrap text-outline tabular-nums"
							>
								Tasa BCV {Number(payment.bcvRate).toFixed(2)}
							</span>
						{/snippet}
						<TriggerTooltip trigger={rateTip} text="Tasa BCV congelada al momento del pago" />
					</div>
					<div class="shrink-0 pt-0.5 text-right">
						<p class="text-[13px] font-semibold whitespace-nowrap text-on-surface tabular-nums">
							{formatPrice(payment.amountBcvUsd)}
						</p>
						<p class="mt-0.5 text-xs whitespace-nowrap text-on-surface-variant tabular-nums">
							{bsFigure(payment)}
						</p>
					</div>
					{#if canVoid()}
						<button
							type="button"
							aria-label="Anular pago"
							onclick={() => openVoidModal(payment)}
							class="grid h-[26px] w-[26px] place-items-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
						>
							<Ellipsis class="h-4 w-4" />
						</button>
					{:else}
						<span></span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if voidedPayments.length > 0}
		<div class="border-t border-outline-variant/60 px-4 py-2 text-xs">
			{#if showVoided}
				<div class="space-y-2 pt-1 pb-2">
					{#each voidedPayments as payment (payment.id)}
						<div class="flex items-center justify-between gap-2 opacity-60">
							<span
								class="text-[13px] font-semibold [overflow-wrap:anywhere] break-words text-on-surface line-through"
							>
								{methodLabel(payment)} · anulado
							</span>
							<span class="text-[13px] font-semibold text-on-surface tabular-nums line-through">
								{formatPrice(payment.amountBcvUsd)}
							</span>
						</div>
					{/each}
				</div>
				<button
					type="button"
					onclick={() => (showVoided = false)}
					class="font-semibold text-on-info-container underline underline-offset-2 hover:opacity-80"
				>
					Ocultar {voidedPayments.length}
					{voidedPayments.length === 1 ? 'anulado' : 'anulados'}
				</button>
			{:else}
				<button
					type="button"
					onclick={() => (showVoided = true)}
					class="font-semibold text-on-info-container underline underline-offset-2 hover:opacity-80"
				>
					Ver {voidedPayments.length}
					{voidedPayments.length === 1 ? 'anulado' : 'anulados'}
				</button>
			{/if}
		</div>
	{/if}
</section>

<ConfirmModal
	bind:open={voidOpen}
	title="Anular pago"
	size="sm"
	message="El monto vuelve al saldo pendiente y el estado de la venta puede revertir si ya estaba lista o entregada."
	confirmLabel="Anular pago"
	confirmColor="red"
	loading={voiding}
	onConfirm={confirmVoid}
	onCancel={() => {
		voidOpen = false;
		voidTarget = null;
		voidReason = '';
		voidError = null;
	}}
>
	{#snippet body()}
		<div class="mt-3">
			<label for="void-payment-reason" class="mb-1 block text-sm font-semibold text-on-surface">
				Motivo de la anulación
			</label>
			<textarea
				id="void-payment-reason"
				bind:value={voidReason}
				rows="3"
				maxlength="500"
				placeholder="Ej. transferencia duplicada, monto incorrecto…"
				class="w-full resize-none rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm [overflow-wrap:anywhere] text-on-surface outline-none focus:border-brand-navy"
			></textarea>
			{#if voidError}
				<p
					class="mt-1.5 rounded-lg bg-error-container/15 px-2.5 py-1.5 text-xs font-medium text-on-error-container"
				>
					{voidError}
				</p>
			{/if}
		</div>
	{/snippet}
</ConfirmModal>
