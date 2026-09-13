<script lang="ts">
	import { formatPrice } from '$lib/utils';
	import type { AdjustedTaxBreakdown } from '../../helpers/taxBreakdown';

	interface Props {
		adjusted: AdjustedTaxBreakdown;
		appliedGlobalDiscount: number;
		taxSummaryLabel: string;
		total: number;
	}

	let { adjusted, appliedGlobalDiscount, taxSummaryLabel, total }: Props = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
	<div class="space-y-1">
		<div class="flex items-center justify-between text-xs">
			<span class="text-slate-500">Subtotal</span>
			<span class="font-semibold text-brand-navy">{formatPrice(adjusted.subtotalBeforeGlobal)}</span
			>
		</div>
		{#if appliedGlobalDiscount > 0}
			<div class="flex items-center justify-between text-xs">
				<span class="text-slate-500">Descuento global</span>
				<span class="font-semibold text-red-500"
					>-{formatPrice(
						adjusted.subtotalBeforeGlobal - adjusted.taxableBase - adjusted.exemptTotal
					)}</span
				>
			</div>
			<div class="flex items-center justify-between text-xs">
				<span class="text-slate-500">Subtotal neto</span>
				<span class="font-semibold text-brand-navy"
					>{formatPrice(adjusted.taxableBase + adjusted.exemptTotal)}</span
				>
			</div>
		{/if}
		<div class="my-1 border-t border-slate-200"></div>
		{#if adjusted.exemptTotal > 0}
			<div class="flex items-center justify-between text-xs">
				<span class="text-slate-500">Monto exento</span>
				<span class="font-semibold text-brand-navy">{formatPrice(adjusted.exemptTotal)}</span>
			</div>
		{/if}
		{#if adjusted.taxableBase > 0}
			<div class="flex items-center justify-between text-xs">
				<span class="text-slate-500">Base imponible</span>
				<span class="font-semibold text-brand-navy">{formatPrice(adjusted.taxableBase)}</span>
			</div>
		{/if}
		<div class="my-1 border-t border-slate-200"></div>
		{#if adjusted.taxAmount > 0}
			<div class="flex items-center justify-between text-xs">
				<span class="text-slate-500">{taxSummaryLabel}</span>
				<span class="font-semibold text-brand-navy">{formatPrice(adjusted.taxAmount)}</span>
			</div>
		{/if}
	</div>
	<div
		class="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-brand-navy"
	>
		<span>Total</span>
		<span>{formatPrice(total)}</span>
	</div>
</div>
