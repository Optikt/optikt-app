<script lang="ts">
	import { X } from '@lucide/svelte';
	import { AppBadge, SlideOver } from '$lib/components/ui';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import type { SalePaymentWithUsers } from '$lib/server/db/queries/sales/payments';
	import { PAYMENT_METHOD_LABELS, PaymentMethod, isBsPaymentMethod } from '$lib/shared/enums';
	import { formatCurrency, formatDate, formatPrice } from '$lib/utils';

	interface Props {
		open: boolean;
		onclose: () => void;
		payments: SalePaymentWithUsers[];
		total: number;
		paidAmount: number;
		canVoid: boolean;
		/** Card delegates the void flow to the owner (single modal with motivo). */
		onVoidRequest: (payment: SalePaymentWithUsers) => void;
	}

	let { open, onclose, payments, total, paidAmount, canVoid, onVoidRequest }: Props = $props();

	const balance = $derived(Math.max(0, total - paidAmount));
	const activePayments = $derived(payments.filter((p) => !p.voidedAt));
	const voidedPayments = $derived(payments.filter((p) => p.voidedAt));
	const ordered = $derived([...activePayments, ...voidedPayments]);

	function methodLabel(payment: SalePaymentWithUsers): string {
		return PAYMENT_METHOD_LABELS[payment.paymentMethod as unknown as PaymentMethod] ?? 'Pago';
	}

	/** Original amount in the method's native currency (never truncated: wraps). */
	function originalAmount(payment: SalePaymentWithUsers): string {
		const method = payment.paymentMethod as unknown as PaymentMethod;
		if (isBsPaymentMethod(method)) return `Bs. ${formatCurrency(Number(payment.amount))}`;
		if (method === PaymentMethod.BINANCE_USDT)
			return `USDT ${formatCurrency(Number(payment.amount))}`;
		if (method === PaymentMethod.EFECTIVO_EUR) return `€ ${formatCurrency(Number(payment.amount))}`;
		return `$ ${formatCurrency(Number(payment.amount))}`;
	}

	/** Frozen rate + its type label (rate travels WITH the amount). */
	function frozenRate(payment: SalePaymentWithUsers): string {
		const method = payment.paymentMethod as unknown as PaymentMethod;
		const typeLabel = rateTypeLabel(payment.rateType);
		if (isBsPaymentMethod(method) || method === PaymentMethod.EFECTIVO_USD) {
			return `@ ${Number(payment.bcvRate).toFixed(2)} · ${typeLabel}`;
		}
		return `@ ${Number(payment.exchangeRate ?? 0).toFixed(2)} · ${typeLabel}`;
	}

	function rateTypeLabel(rateType: string | null): string {
		switch (rateType) {
			case 'USDT':
				return 'USDT';
			case 'USD_PAYPAL':
				return 'PayPal';
			case 'EUR_BCV':
				return 'EUR · BCV';
			case 'EUR_EFECTIVO':
				return 'EUR efectivo';
			case 'USD_EFECTIVO':
				return 'USD efectivo';
			case 'OTHER':
				return 'Otro';
			default:
				return 'BCV';
		}
	}
</script>

<SlideOver {open} {onclose} widthClass="w-full sm:w-[440px]" bodyClass="px-4 py-3">
	{#snippet header({ onclose: close })}
		<div class="flex items-center gap-3 border-b border-outline-variant/15 px-4 py-3.5">
			<h2 class="font-heading min-w-0 flex-1 text-lg font-semibold text-brand-navy">
				Pagos de la venta
			</h2>
			<AppBadge variant="neutral">{payments.length}</AppBadge>
			<button
				type="button"
				onclick={close}
				class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
				aria-label="Cerrar"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<!-- Franja Total / Cobrado / Saldo -->
	<div class="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-container-low p-3">
		<div class="min-w-0">
			<p class="text-[11px] font-semibold tracking-[0.12em] text-outline uppercase">Total</p>
			<p class="mt-0.5 text-sm font-bold text-on-surface tabular-nums">{formatPrice(total)}</p>
		</div>
		<div class="min-w-0">
			<p class="text-[11px] font-semibold tracking-[0.12em] text-outline uppercase">Cobrado</p>
			<p class="mt-0.5 text-sm font-bold text-emerald-700 tabular-nums">
				{formatPrice(paidAmount)}
			</p>
		</div>
		<div class="min-w-0">
			<p class="text-[11px] font-semibold tracking-[0.12em] text-outline uppercase">Saldo</p>
			<p class="mt-0.5 text-sm font-bold text-brand-navy tabular-nums">{formatPrice(balance)}</p>
		</div>
	</div>

	{#if ordered.length === 0}
		<p class="px-2 py-7 text-center text-[13px] text-outline italic">
			Aún no hay abonos registrados
		</p>
	{:else}
		<div class="space-y-2.5">
			{#each ordered as payment (payment.id)}
				{@const voided = !!payment.voidedAt}
				<article
					class="rounded-xl border border-outline-variant/60 bg-white p-3.5"
					class:bg-[#fbfafb]={voided}
				>
					<div class="flex flex-wrap items-center gap-2">
						<h3
							class="min-w-0 flex-1 text-[13px] font-semibold [overflow-wrap:anywhere] break-words text-on-surface"
						>
							{methodLabel(payment)}
						</h3>
						<AppBadge variant={voided ? 'neutral' : 'success'}>
							{voided ? 'Anulado' : 'Vigente'}
						</AppBadge>
					</div>

					<p class="mt-1 text-xl font-bold text-on-surface tabular-nums">
						{formatPrice(Number(payment.amountBcvUsd))}
					</p>

					<dl class="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
						<div class="min-w-0">
							<dt class="font-semibold tracking-wide text-outline uppercase">Monto original</dt>
							<dd
								class="mt-0.5 font-medium [overflow-wrap:anywhere] break-words text-on-surface tabular-nums"
							>
								{originalAmount(payment)}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="font-semibold tracking-wide text-outline uppercase">Tasa congelada</dt>
							<dd class="mt-0.5">
								{#snippet rateTip({ props }: { props: Record<string, unknown> })}
									<span
										{...props}
										class="cursor-help font-mono text-[11px] [overflow-wrap:anywhere] break-words text-on-surface-variant tabular-nums"
									>
										{frozenRate(payment)}
									</span>
								{/snippet}
								<TriggerTooltip trigger={rateTip} text="Tasa congelada al momento del pago" />
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="font-semibold tracking-wide text-outline uppercase">Fecha y hora</dt>
							<dd class="mt-0.5 [overflow-wrap:anywhere] break-words text-on-surface">
								{formatDate(payment.paymentDate, { dateStyle: 'medium', timeStyle: 'short' })}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="font-semibold tracking-wide text-outline uppercase">Registrado por</dt>
							<dd class="mt-0.5 [overflow-wrap:anywhere] break-words text-on-surface">
								{payment.createdByName ?? '—'}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="font-semibold tracking-wide text-outline uppercase">Referencia</dt>
							<dd class="mt-0.5 [overflow-wrap:anywhere] break-words text-on-surface">
								{payment.reference?.trim() ? payment.reference : '—'}
							</dd>
						</div>
						<div class="min-w-0">
							<dt class="font-semibold tracking-wide text-outline uppercase">Equiv. USD BCV</dt>
							<dd class="mt-0.5 font-medium text-on-surface tabular-nums">
								{formatPrice(Number(payment.amountBcvUsd))}
							</dd>
						</div>
						<div class="col-span-2 min-w-0">
							<dt class="font-semibold tracking-wide text-outline uppercase">Notas</dt>
							<dd class="mt-0.5 [overflow-wrap:anywhere] break-words text-on-surface">
								{payment.notes?.trim() ? payment.notes : '—'}
							</dd>
						</div>
					</dl>

					{#if voided}
						<div class="mt-2.5 rounded-lg bg-surface-container-low p-2.5 text-xs">
							<p class="[overflow-wrap:anywhere] break-words text-on-surface">
								<span class="font-semibold">Motivo:</span>
								{payment.voidReason?.trim() ? payment.voidReason : '—'}
							</p>
							<p class="mt-1 [overflow-wrap:anywhere] break-words text-on-surface-variant">
								Anulado por {payment.voidedByName ?? '—'}
								{#if payment.voidedAt}
									· {formatDate(payment.voidedAt, { dateStyle: 'medium', timeStyle: 'short' })}
								{/if}
							</p>
						</div>
					{:else if canVoid}
						<button
							type="button"
							onclick={() => onVoidRequest(payment)}
							class="mt-2.5 inline-flex h-8 cursor-pointer items-center rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
						>
							Anular este pago
						</button>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</SlideOver>
