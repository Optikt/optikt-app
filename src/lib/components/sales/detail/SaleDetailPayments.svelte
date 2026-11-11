<script lang="ts">
	import { CreditCard, Ellipsis, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ConfirmModal } from '$lib/components/ui';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { voidPayment } from '$lib/remote/sales/payments.remote';
	import {
		PAYMENT_METHOD_LABELS,
		PaymentMethod,
		isBsPaymentMethod
	} from '$lib/shared/enums';
	import { logger } from '$lib/utils/logger';
	import { formatCurrency, formatDateOnly, formatPrice } from '$lib/utils';
	import { getErrorMessage } from '$lib/utils/errors';
	import type { SalePayment } from '$lib/server/db/schema';

	interface Props {
		/** Includes voided payments (loader) — they render collapsed behind a link. */
		payments: SalePayment[];
		/** Non-viewer role (register + void). */
		canAct: boolean;
		isCancelled: boolean;
		remainingBcvUsd: number;
		/** Opens the payment drawer (page owns the drawer). */
		onRegister: () => void;
		/** A void succeeded: the page invalidates + syncs (saldo, barra, estados). */
		onChanged: () => void;
	}

	let { payments, canAct, isCancelled, remainingBcvUsd, onRegister, onChanged }: Props = $props();

	const activePayments = $derived(payments.filter((p) => !p.voidedAt));
	const voidedPayments = $derived(payments.filter((p) => p.voidedAt));
	const canRegister = $derived(canAct && !isCancelled && remainingBcvUsd > 0.01);

	let showVoided = $state(false);
	let voidTarget = $state<SalePayment | null>(null);
	let voidOpen = $state(false);
	let voiding = $state(false);

	function canVoid(): boolean {
		return canAct && !isCancelled;
	}

	function methodLabel(payment: SalePayment): string {
		return PAYMENT_METHOD_LABELS[payment.paymentMethod as unknown as PaymentMethod] ?? 'Pago';
	}

	/** Line 2: original amount + frozen rate (rate travels WITH the amount, never with the date). */
	function amountLine(payment: SalePayment): { amount: string; rate: string } {
		const method = payment.paymentMethod as unknown as PaymentMethod;
		if (isBsPaymentMethod(method)) {
			return {
				amount: `Bs. ${formatCurrency(Number(payment.amount))}`,
				rate: `@ ${Number(payment.bcvRate).toFixed(2)}`
			};
		}
		if (method === PaymentMethod.BINANCE_USDT) {
			return {
				amount: `USDT ${formatCurrency(Number(payment.amount))}`,
				rate: `@ ${Number(payment.exchangeRate ?? 0).toFixed(2)}`
			};
		}
		if (method === PaymentMethod.EFECTIVO_EUR) {
			return {
				amount: `€ ${formatCurrency(Number(payment.amount))}`,
				rate: `@ ${Number(payment.bcvRate).toFixed(2)}`
			};
		}
		// USD-native: show the Bs. equivalent at the payment's own frozen rate.
		return {
			amount: `Bs. ${formatCurrency(payment.amountBcvUsd * Number(payment.bcvRate))}`,
			rate: `@ ${Number(payment.bcvRate).toFixed(2)}`
		};
	}

	async function confirmVoid() {
		if (!voidTarget || voiding) return;
		voiding = true;
		try {
			const result = await voidPayment({ id: voidTarget.id, saleId: voidTarget.saleId });
			if (result.success) {
				toast.success('Pago anulado: el saldo se actualizó');
				voidOpen = false;
				voidTarget = null;
				onChanged();
			} else {
				toast.error(result.error);
			}
		} catch (error) {
			logger.error('Error anulando el pago', error);
			toast.error(getErrorMessage(error, 'No se pudo anular el pago'));
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
				{@const line = amountLine(payment)}
				<div class="grid grid-cols-[32px_1fr_auto_26px] items-center gap-3 px-4 py-2.5">
					<span class="grid h-[32px] w-[32px] place-items-center rounded-lg bg-surface-container-high text-brand-navy">
						<CreditCard class="h-4 w-4" />
					</span>
					<div class="min-w-0">
						<p class="truncate text-[13px] font-semibold text-on-surface">
							{methodLabel(payment)}
						</p>
						<p class="truncate text-xs text-on-surface-variant">
							{formatDateOnly(payment.paymentDate, { dateStyle: 'medium' })}
							{#if payment.reference}&nbsp;· Ref. {payment.reference}{/if}
						</p>
					</div>
					<div class="text-right">
						<p class="text-[13px] font-semibold text-on-surface tabular-nums">
							{formatPrice(payment.amountBcvUsd)}
						</p>
						{#snippet rateTip({ props }: { props: Record<string, unknown> })}
							<div
								{...props}
								class="cursor-help text-xs text-on-surface-variant tabular-nums"
							>
								{line.amount}
								<span class="font-mono text-[11px] text-outline">{line.rate}</span>
							</div>
						{/snippet}
						<TriggerTooltip trigger={rateTip} text="Tasa congelada al momento del pago" />
					</div>
					{#if canVoid()}
						<button
							type="button"
							aria-label="Anular pago"
							onclick={() => {
								voidTarget = payment;
								voidOpen = true;
							}}
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
							<span class="text-[13px] font-semibold text-on-surface line-through">
								{methodLabel(payment)} · anulado
							</span>
							<span class="text-[13px] font-semibold text-on-surface line-through tabular-nums">
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
	}}
/>
