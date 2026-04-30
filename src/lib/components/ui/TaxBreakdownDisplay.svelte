<script lang="ts">
	import { formatPrice } from '$lib/utils';

	interface Props {
		taxableBase: number;
		exemptTotal: number;
		taxAmount: number;
		taxLabel?: string | null;
		/** When provided, renders a "Total (sin desc. global)" row at the bottom of the card variant. */
		subtotal?: number;
		/** "card" wraps in a titled card; "inline" renders bare rows for embedding. */
		variant?: 'card' | 'inline';
	}

	let {
		taxableBase,
		exemptTotal,
		taxAmount,
		taxLabel = null,
		subtotal,
		variant = 'card'
	}: Props = $props();

	let visible = $derived(taxAmount > 0 || exemptTotal > 0);
</script>

{#if visible}
	{#if variant === 'card'}
		<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
			<p class="mb-3 text-sm font-bold tracking-widest text-slate-500 uppercase">Desglose Fiscal</p>
			<div class="space-y-2">
				{#if taxableBase > 0}
					<div class="flex items-center justify-between text-base">
						<span class="text-slate-600">Base Imponible</span>
						<span class="font-mono font-semibold text-slate-800">{formatPrice(taxableBase)}</span>
					</div>
				{/if}
				{#if exemptTotal > 0}
					<div class="flex items-center justify-between text-base">
						<span class="text-slate-600">Exento</span>
						<span class="font-mono font-semibold text-slate-800">{formatPrice(exemptTotal)}</span>
					</div>
				{/if}
				{#if taxAmount > 0}
					<div class="flex items-center justify-between text-base">
						<span class="text-slate-600">{taxLabel ?? 'IVA'}</span>
						<span class="font-mono font-semibold text-slate-800">{formatPrice(taxAmount)}</span>
					</div>
				{/if}
				{#if subtotal != null}
					<div class="flex items-center justify-between border-t border-slate-200 pt-2 text-base">
						<span class="font-semibold text-slate-700">Total (sin desc. global)</span>
						<span class="font-mono font-semibold text-slate-900">{formatPrice(subtotal)}</span>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<hr class="border-slate-200" />
		{#if taxableBase > 0}
			<div class="flex justify-between text-base">
				<span class="text-slate-500">Base Imponible</span>
				<span class="font-mono font-medium text-slate-700">{formatPrice(taxableBase)}</span>
			</div>
		{/if}
		{#if exemptTotal > 0}
			<div class="flex justify-between text-base">
				<span class="text-slate-500">Exento</span>
				<span class="font-mono font-medium text-slate-700">{formatPrice(exemptTotal)}</span>
			</div>
		{/if}
		{#if taxAmount > 0}
			<div class="flex justify-between text-base">
				<span class="text-slate-500">{taxLabel ?? 'IVA'}</span>
				<span class="font-mono font-medium text-slate-700">{formatPrice(taxAmount)}</span>
			</div>
		{/if}
	{/if}
{/if}
