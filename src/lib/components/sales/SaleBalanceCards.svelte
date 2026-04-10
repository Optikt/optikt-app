<script lang="ts">
	import { formatPrice } from '$lib/utils';
	import { DiscountType, RefundStatus } from '$lib/shared/enums';

	interface TaxBreakdown {
		taxableBase: number;
		exemptTotal: number;
		taxAmount: number;
	}

	interface Props {
		subtotal: number;
		total: number;
		discountType: string;
		discount: number;
		paidAmountBcvUsd: number;
		remainingBcvUsd: number;
		paymentProgressPercent: number;
		paymentsCount: number;
		taxBreakdown: TaxBreakdown;
		isCancelled: boolean;
		isCompleted: boolean;
		refundStatus?: string | null;
		refundAmount?: number | null;
		refundDecisionTitle: string;
	}

	let {
		subtotal,
		total,
		discountType,
		discount,
		paidAmountBcvUsd,
		remainingBcvUsd,
		paymentProgressPercent,
		paymentsCount,
		taxBreakdown,
		isCancelled,
		isCompleted,
		refundStatus,
		refundAmount,
		refundDecisionTitle
	}: Props = $props();

	let saleDiscountAmount = $derived.by(() => {
		if (discountType === DiscountType.PERCENTAGE) {
			return (discount / 100) * subtotal;
		}

		return discount;
	});
</script>

<section class="grid gap-4 xl:grid-cols-4">
	<div class="rounded-[1.5rem] bg-surface-container-low px-6 py-6 shadow-sm">
		<div class="space-y-4 text-sm text-on-surface-variant">
			<div class="flex items-center justify-between gap-4">
				<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
					>Subtotal</span
				>
				<span class="font-mono text-base font-semibold text-brand-navy"
					>{formatPrice(subtotal)}</span
				>
			</div>

			{#if saleDiscountAmount > 0}
				<div class="flex items-center justify-between gap-4">
					<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
						Descuento global
						{#if discountType === DiscountType.PERCENTAGE}
							({discount}%)
						{/if}
					</span>
					<span class="font-mono text-base font-semibold text-error"
						>-{formatPrice(saleDiscountAmount)}</span
					>
				</div>
			{/if}

			<div class="h-px bg-surface-container-high"></div>

			<div class="flex items-center justify-between gap-4">
				<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
					>Subtotal neto</span
				>
				<span class="font-mono text-base font-semibold text-brand-navy"
					>{formatPrice(subtotal - saleDiscountAmount)}</span
				>
			</div>

			{#if taxBreakdown.taxableBase > 0}
				<div class="flex items-center justify-between gap-4">
					<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
						>Base imponible</span
					>
					<span class="font-mono text-base font-semibold text-brand-navy"
						>{formatPrice(taxBreakdown.taxableBase)}</span
					>
				</div>
			{/if}

			{#if taxBreakdown.exemptTotal > 0}
				<div class="flex items-center justify-between gap-4">
					<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
						>Exento</span
					>
					<span class="font-mono text-base font-semibold text-brand-navy"
						>{formatPrice(taxBreakdown.exemptTotal)}</span
					>
				</div>
			{/if}

			{#if taxBreakdown.taxAmount > 0}
				<div class="flex items-center justify-between gap-4">
					<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
						>IVA (16%)</span
					>
					<span class="font-mono text-base font-semibold text-brand-navy"
						>{formatPrice(taxBreakdown.taxAmount)}</span
					>
				</div>
			{/if}
		</div>

		<div class="mt-8 border-t border-surface-container-high pt-6">
			<p class="text-sm font-bold tracking-[0.14em] text-brand-navy uppercase">Total a pagar</p>
			<p class="mt-3 font-mono text-4xl font-bold tracking-tight text-brand-navy md:text-[2.85rem]">
				{formatPrice(total)}
			</p>
		</div>
	</div>

	<div class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-6 shadow-sm">
		<p class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Total deuda</p>
		<p class="mt-4 font-mono text-3xl font-bold tracking-tight text-brand-navy md:text-4xl">
			{formatPrice(total)}
		</p>
		<p class="mt-3 text-base text-on-surface-variant">Monto total comprometido en esta venta.</p>
	</div>

	<div class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-6 shadow-sm">
		<p class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Total pagado</p>
		<p class="mt-4 font-mono text-3xl font-bold tracking-tight text-success md:text-4xl">
			{formatPrice(paidAmountBcvUsd)}
		</p>
		{#if paymentsCount > 0}
			<p class="mt-3 text-base text-on-surface-variant">
				{paymentsCount} pago{paymentsCount !== 1 ? 's' : ''} registrado{paymentsCount !== 1
					? 's'
					: ''}
			</p>
		{:else}
			<p class="mt-3 text-base text-on-surface-variant">Aún no se han registrado abonos.</p>
		{/if}
	</div>

	<div
		class="rounded-[1.5rem] px-6 py-6 shadow-[0_10px_30px_rgba(21,35,70,0.14)] {remainingBcvUsd >
		0.01
			? 'bg-brand-navy text-white'
			: 'bg-success-container text-on-success-container'}"
	>
		<div class="flex items-start justify-between gap-4">
			<div>
				<p
					class="text-xs font-semibold tracking-[0.14em] uppercase {remainingBcvUsd > 0.01
						? 'text-white/68'
						: 'text-on-success-container/70'}"
				>
					Saldo pendiente
				</p>
				<p
					class="mt-4 font-mono text-3xl font-bold tracking-tight md:text-4xl {remainingBcvUsd >
					0.01
						? 'text-white'
						: 'text-on-success-container'}"
				>
					{formatPrice(remainingBcvUsd)}
				</p>
			</div>

			<span
				class="rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.16em] uppercase {remainingBcvUsd >
				0.01
					? 'bg-brand-gold/15 text-brand-gold'
					: 'bg-white/30 text-on-success-container'}"
			>
				{remainingBcvUsd > 0.01 ? 'Prioridad' : 'Cubierto'}
			</span>
		</div>

		<div class="mt-6 h-2 rounded-full {remainingBcvUsd > 0.01 ? 'bg-white/10' : 'bg-white/35'}">
			<div
				class="h-full rounded-full {remainingBcvUsd > 0.01 ? 'bg-brand-gold' : 'bg-white'}"
				style={`width: ${paymentProgressPercent}%`}
			></div>
		</div>

		<div
			class="mt-3 flex items-center justify-between text-sm {remainingBcvUsd > 0.01
				? 'text-white/75'
				: 'text-on-success-container/80'}"
		>
			<span>Cubierto</span>
			<span class="font-mono font-semibold">{formatPrice(paidAmountBcvUsd)}</span>
		</div>

		<div class="mt-4 space-y-3">
			{#if isCancelled && refundStatus && refundStatus !== RefundStatus.NO_PAYMENT}
				<p
					class="text-base {remainingBcvUsd > 0.01
						? 'text-white/80'
						: 'text-on-success-container/80'}"
				>
					{refundDecisionTitle} por
					<span class="font-mono font-semibold">{formatPrice(refundAmount ?? 0)}</span>
				</p>
			{:else if remainingBcvUsd > 0.01}
				<p class="text-base text-white/80">Este es el monto que falta para cerrar la venta.</p>
			{:else if isCompleted}
				<p class="text-base text-on-success-container/80">
					La venta ya quedó completamente cubierta.
				</p>
			{/if}
		</div>
	</div>
</section>
