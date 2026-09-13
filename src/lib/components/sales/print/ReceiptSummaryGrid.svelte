<script lang="ts">
	import { getPaymentMethodLabel } from '$lib/shared/enums';
	import type { SalePayment } from '$lib/server/db/schema';
	import { formatPrice } from '$lib/utils';
	import {
		formatOriginalPaymentAmount,
		formatPaymentBcvAmount,
		formatPaymentReceiptDate,
		formatTaxRate,
		type ReceiptViewModel
	} from './receiptData';

	interface Props {
		payments: SalePayment[];
		adjusted: ReceiptViewModel['adjusted'];
		hasDiscount: boolean;
		discountOnBase: number;
		ivaRate: number | null;
		saleTotal: number;
		remainingAmount: number;
		showRemainingAmount: boolean;
	}

	let {
		payments,
		adjusted,
		hasDiscount,
		discountOnBase,
		ivaRate,
		saleTotal,
		remainingAmount,
		showRemainingAmount
	}: Props = $props();
</script>

<section class="receipt-grid grid grid-cols-2 gap-[10px]">
	<div class="receipt-box rounded-[4px] border-[0.5px] border-[#e0e0e0] px-[9px] py-[7px]">
		<p class="mb-[5px] text-[9px] font-medium tracking-[0.08em] text-slate-400 uppercase">
			Pagos registrados
		</p>

		{#if payments.length === 0}
			<p class="mt-3 text-[10px] text-slate-400 italic">
				Sin pagos registrados al momento de generar este recibo
			</p>
		{:else}
			<div class="space-y-[3px]">
				{#each payments as payment (payment.id)}
					<div class="border-b-[0.5px] border-[#f0f0f0] last:border-b-0">
						<div class="flex items-start justify-between gap-3">
							<p class="min-w-0 text-[10px] font-medium text-slate-950">
								{getPaymentMethodLabel(payment.paymentMethod)}:
							</p>
							<p
								class="shrink-0 text-right font-mono text-[10px] font-medium text-slate-950 tabular-nums"
							>
								{formatOriginalPaymentAmount(payment)}
							</p>
						</div>
						<p class="text-[9.5px] text-slate-500">
							{formatPaymentReceiptDate(payment.paymentDate)}
							{#if payment.reference}
								| Ref: {payment.reference.slice(-6)}
							{/if}
							| {formatPaymentBcvAmount(payment)}
						</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="receipt-box rounded-[4px] border-[0.5px] border-[#e0e0e0] px-[9px] py-[7px]">
		<p class="mb-[4px] text-[9px] font-medium tracking-[0.08em] text-slate-400 uppercase">
			Totales
		</p>

		<div class="space-y-[2px] text-[10px] text-slate-700">
			{#if hasDiscount}
				<div class="flex items-center justify-between gap-3">
					<span>Subtotal</span>
					<span class="font-mono text-slate-950 tabular-nums">
						{formatPrice(adjusted.subtotalBeforeGlobal)}
					</span>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span>Descuento global</span>
					<span class="font-mono text-slate-950 tabular-nums">
						-{formatPrice(discountOnBase)}
					</span>
				</div>
			{/if}
			{#if adjusted.taxableBase > 0}
				<div class="flex items-center justify-between gap-3">
					<span>Base imponible</span>
					<span class="font-mono text-slate-950 tabular-nums">
						{formatPrice(adjusted.taxableBase)}
					</span>
				</div>
			{/if}

			{#if adjusted.exemptTotal > 0}
				<div class="flex items-center justify-between gap-3">
					<span>Exento</span>
					<span class="font-mono text-slate-950 tabular-nums">
						{formatPrice(adjusted.exemptTotal)}
					</span>
				</div>
			{/if}

			<div class="flex items-center justify-between gap-3">
				<span>Subtotal neto</span>
				<span class="font-mono text-slate-950 tabular-nums"
					>{formatPrice(adjusted.taxableBase + adjusted.exemptTotal)}</span
				>
			</div>

			{#if adjusted.taxAmount > 0}
				<div class="flex items-center justify-between gap-3">
					<span
						>IVA{#if ivaRate !== null}
							({formatTaxRate(ivaRate)}%){/if}</span
					>
					<span class="font-mono text-slate-950 tabular-nums">
						{formatPrice(adjusted.taxAmount)}
					</span>
				</div>
			{/if}

			<div
				class="mt-1 flex items-center justify-between gap-3 border-t-[0.5px] border-[#ddd] pt-[5px] text-[12px] font-medium text-slate-950"
			>
				<span>Total</span>
				<span class="font-mono tabular-nums">{formatPrice(saleTotal)}</span>
			</div>

			{#if showRemainingAmount}
				<div class="mt-[5px] border-t-[0.5px] border-[#eee] pt-[5px]">
					<div
						class="flex items-center justify-between gap-3 text-[10px] font-medium text-slate-950"
					>
						<span>Monto pendiente</span>
						<span class="font-mono tabular-nums">{formatPrice(remainingAmount)}</span>
					</div>
					<p class="text-[8.5px] leading-[1.3] text-slate-500">
						Monto pendiente a la fecha de generación.
					</p>
				</div>
			{/if}
		</div>
	</div>
</section>
