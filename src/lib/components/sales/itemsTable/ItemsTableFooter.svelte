<script lang="ts">
	import { computeDiscount, formatPrice } from '$lib/utils';

	interface Props {
		subtotal: number;
		discount?: number;
		discountType?: string;
		total?: number;
		hasAnyCost: boolean;
		totalInternalCost: number;
	}

	let {
		subtotal,
		discount = 0,
		discountType = 'FIXED',
		total,
		hasAnyCost,
		totalInternalCost
	}: Props = $props();
</script>

<div class="border-t border-gray-200 bg-gray-50/50 px-5 py-4">
	{#if hasAnyCost}
		<div class="flex items-center justify-between">
			<span class="text-xs font-medium tracking-wider text-gray-400 uppercase">
				Costo interno total
			</span>
			<span class="text-xs font-medium text-gray-500">
				{formatPrice(totalInternalCost)}
			</span>
		</div>
		<div class="mt-2 border-t border-gray-200 pt-2"></div>
	{/if}
	<div class="flex items-center justify-between">
		<span class="text-sm font-bold text-gray-700">Subtotal general</span>
		<span class="text-base font-bold text-gray-900">{formatPrice(subtotal)}</span>
	</div>
	{#if discount > 0 && total != null}
		{@const discountAmount = computeDiscount(discount, discountType, subtotal)}
		<div class="mt-1 flex items-center justify-between">
			<span class="text-xs font-medium tracking-wider text-gray-400 uppercase"
				>Descuento {#if discountType === 'PERCENTAGE'}({discount}%){/if}</span
			>
			<span class="text-xs font-semibold text-red-500">-{formatPrice(discountAmount)}</span>
		</div>
	{/if}
	{#if total != null}
		<div class="mt-1 flex items-center justify-between border-t border-gray-100 pt-1">
			<span class="text-sm font-bold text-gray-700">Total</span>
			<span class="text-base font-bold text-gray-900">{formatPrice(total)}</span>
		</div>
	{/if}
</div>
