<script lang="ts">
	import { formatPrice } from '$lib/utils';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';

	interface Props {
		discount: number;
		discountType: DiscountTypeEnum;
		globalDiscountMax: number;
		hasInvalidGlobalDiscount: boolean;
		grossSubtotal: number;
	}

	let {
		discount = $bindable(),
		discountType = $bindable(),
		globalDiscountMax,
		hasInvalidGlobalDiscount,
		grossSubtotal
	}: Props = $props();
</script>

<div class="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
	<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Descuento global</p>
	<div class="mt-1.5 grid grid-cols-2 gap-1">
		<button
			type="button"
			onclick={() => {
				discountType = DiscountType.FIXED;
			}}
			class="rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors {discountType ===
			DiscountType.FIXED
				? 'bg-brand-navy text-white'
				: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
		>
			Monto ($)
		</button>
		<button
			type="button"
			onclick={() => {
				discountType = DiscountType.PERCENTAGE;
			}}
			class="rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors {discountType ===
			DiscountType.PERCENTAGE
				? 'bg-brand-navy text-white'
				: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
		>
			Porc. (%)
		</button>
	</div>
	<div class="relative mt-1.5">
		<input
			type="number"
			bind:value={discount}
			step="0.01"
			min="0"
			max={globalDiscountMax}
			class="w-full rounded-lg py-1 pr-2 pl-6 text-right font-mono text-xs font-semibold focus:outline-none {hasInvalidGlobalDiscount
				? 'border border-red-300 bg-red-50 text-red-600'
				: 'border border-slate-200 bg-white text-brand-navy'}"
			aria-invalid={hasInvalidGlobalDiscount}
		/>
		<span class="absolute top-1/2 left-2 -translate-y-1/2 text-[10px] text-slate-400">
			{discountType === DiscountType.FIXED ? '$' : '%'}
		</span>
	</div>
	{#if hasInvalidGlobalDiscount}
		<p class="mt-1 text-[9px] font-semibold text-error">
			Max: {discountType === DiscountType.PERCENTAGE ? '100%' : formatPrice(grossSubtotal)}
		</p>
	{/if}
</div>
