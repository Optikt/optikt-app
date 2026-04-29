<script lang="ts">
	import { formatPrice } from '$lib/utils';
	import { DiscountType } from '$lib/shared/enums';

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
		taxBreakdown: TaxBreakdown;
		taxLabel?: string | null;
		totalLabel?: string;
	}

	let {
		subtotal,
		total,
		discountType,
		discount,
		taxBreakdown,
		taxLabel = null,
		totalLabel = 'Total a pagar'
	}: Props = $props();

	let discountAmount = $derived.by(() => {
		if (discountType === DiscountType.PERCENTAGE) {
			return (discount / 100) * subtotal;
		}

		return discount;
	});
</script>

<div class="rounded-[1.5rem] bg-surface-container-low px-6 py-6 shadow-sm">
	<div class="space-y-4 text-sm text-on-surface-variant">
		<div class="flex items-center justify-between gap-4">
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Subtotal</span>
			<span class="font-mono text-base font-semibold text-brand-navy">{formatPrice(subtotal)}</span>
		</div>

		{#if discountAmount > 0}
			<div class="flex items-center justify-between gap-4">
				<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
					Descuento global
					{#if discountType === DiscountType.PERCENTAGE}
						({discount}%)
					{/if}
				</span>
				<span class="font-mono text-base font-semibold text-error"
					>-{formatPrice(discountAmount)}</span
				>
			</div>
		{/if}

		<div class="h-px bg-surface-container-high"></div>

		<div class="flex items-center justify-between gap-4">
			<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
				>Subtotal neto</span
			>
			<span class="font-mono text-base font-semibold text-brand-navy">
				{formatPrice(subtotal - discountAmount)}
			</span>
		</div>

		{#if taxBreakdown.taxableBase > 0}
			<div class="flex items-center justify-between gap-4">
				<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
					>Base imponible</span
				>
				<span class="font-mono text-base font-semibold text-brand-navy">
					{formatPrice(taxBreakdown.taxableBase)}
				</span>
			</div>
		{/if}

		{#if taxBreakdown.exemptTotal > 0}
			<div class="flex items-center justify-between gap-4">
				<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Exento</span>
				<span class="font-mono text-base font-semibold text-brand-navy">
					{formatPrice(taxBreakdown.exemptTotal)}
				</span>
			</div>
		{/if}

		{#if taxBreakdown.taxAmount > 0}
			<div class="flex items-center justify-between gap-4">
				<span class="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
					>{taxLabel ?? 'IVA'}</span
				>
				<span class="font-mono text-base font-semibold text-brand-navy">
					{formatPrice(taxBreakdown.taxAmount)}
				</span>
			</div>
		{/if}
	</div>

	<div class="mt-8 border-t border-surface-container-high pt-6">
		<p class="text-sm font-bold tracking-[0.14em] text-brand-navy uppercase">{totalLabel}</p>
		<p class="mt-3 font-mono text-4xl font-bold tracking-tight text-brand-navy md:text-[2.85rem]">
			{formatPrice(total)}
		</p>
	</div>
</div>
