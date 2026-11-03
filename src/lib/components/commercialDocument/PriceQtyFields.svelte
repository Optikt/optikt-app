<script lang="ts">
	/**
	 * Inline price block shared by the item editors:
	 * quantity stepper, unit price, discount ($/%) and live line total.
	 * One flex row aligned to `flex-start` so every label sits on the same
	 * baseline; the «Ref.» hint is absolutely positioned so it never shifts
	 * the row, and the line total hugs the right edge (mockup §8.4).
	 */
	import { DiscountType } from '$lib/shared/enums';
	import { computeDiscount, formatPrice } from '$lib/utils';
	import QtyStepper from './QtyStepper.svelte';
	import DiscountSegmented from './DiscountSegmented.svelte';

	interface Props {
		unitPrice: number;
		quantity: number;
		discount: number;
		discountType: string;
		onPrice: (value: number) => void;
		onQty: (value: number) => void;
		onDiscount: (value: number) => void;
		onDiscountType: (type: string) => void;
		/** Catalog reference price, shown when the user overrides it. */
		referencePrice?: number;
		priceLabel?: string;
		disabled?: boolean;
	}

	let {
		unitPrice,
		quantity,
		discount,
		discountType,
		onPrice,
		onQty,
		onDiscount,
		onDiscountType,
		referencePrice,
		priceLabel = 'Precio unit.',
		disabled = false
	}: Props = $props();

	const showRefHint = $derived(referencePrice !== undefined && referencePrice !== unitPrice);
	const refHint = $derived(
		showRefHint && referencePrice !== undefined ? formatPrice(referencePrice) : null
	);
	const gross = $derived(unitPrice * quantity);
	const discountAmount = $derived(
		Math.min(gross, Math.max(0, computeDiscount(discount, discountType, gross)))
	);
	const net = $derived(gross - discountAmount);
</script>

<div class="flex flex-wrap items-start gap-x-3 gap-y-2.5">
	<div class="flex flex-col gap-1">
		<span class="block text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">
			Cantidad
		</span>
		<QtyStepper value={quantity} onChange={onQty} {disabled} />
	</div>

	<div class="relative flex flex-col gap-1">
		<span class="block text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">
			{priceLabel}
		</span>
		<div
			class="flex h-9 w-[110px] items-center gap-1.5 rounded-lg border border-outline-variant/70 bg-white px-2.5 transition focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20 dark:border-slate-600 dark:bg-slate-800"
		>
			<input
				type="number"
				min="0"
				step="0.01"
				{disabled}
				value={unitPrice}
				class="w-full border-none bg-transparent text-sm text-brand-navy tabular-nums outline-none dark:text-white"
				oninput={(event) => {
					const raw = Number.parseFloat(event.currentTarget.value);
					onPrice(Number.isNaN(raw) || raw < 0 ? 0 : raw);
				}}
			/>
			<span class="text-xs text-slate-400">$</span>
		</div>
		{#if refHint}
			<span
				class="pointer-events-none absolute top-full left-0 text-[11px] whitespace-nowrap text-on-surface-variant/70 tabular-nums"
			>
				Ref. {refHint}
			</span>
		{/if}
	</div>

	<div class="flex flex-col gap-1">
		<span class="block text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">
			Descuento
		</span>
		<DiscountSegmented
			type={discountType}
			value={discount}
			onType={onDiscountType}
			onValue={onDiscount}
			{disabled}
		/>
	</div>

	<div class="ml-auto flex flex-col gap-1 text-right">
		<span
			class="block text-right text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase"
		>
			Precio final
		</span>
		<span
			class="font-heading text-[20px] leading-9 font-bold text-brand-navy tabular-nums dark:text-white"
		>
			{formatPrice(net)}
		</span>
	</div>
</div>

{#if discountType === DiscountType.PERCENTAGE && discount > 100}
	<p class="mt-1 text-[11px] text-red-600 dark:text-red-400">
		El porcentaje no puede superar 100%.
	</p>
{/if}
