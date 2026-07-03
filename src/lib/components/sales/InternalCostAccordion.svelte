<script lang="ts">
	import { Disclosure } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';

	interface Props {
		costOverrides: import('./newSaleTypes').CostOverrides;
		shippingCostPending: boolean;
		eyeCount: number;
		open: boolean;
	}

	let {
		costOverrides = $bindable(),
		shippingCostPending = $bindable(),
		eyeCount,
		open = $bindable()
	}: Props = $props();

	const effectiveShipping = $derived(shippingCostPending ? 0 : costOverrides.shippingPrice);
	const internalCostTotal = $derived(
		costOverrides.baseCost + costOverrides.mountingPrice + effectiveShipping
	);
</script>

<Disclosure
	title="Costo interno"
	bind:open
	summaryValue={formatPrice(internalCostTotal)}
	statusBadge={shippingCostPending ? 'Pendiente' : undefined}
	statusVariant="warning"
>
	<div class="space-y-1.5 text-xs text-on-surface-variant">
		<div class="flex items-center justify-between gap-2">
			<span>Cristales × {eyeCount}</span>
			<input
				type="number"
				bind:value={costOverrides.baseCost}
				step="0.01"
				min="0"
				class="w-24 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
			/>
		</div>
		<div class="flex items-center justify-between gap-2">
			<span>Montaje</span>
			<input
				type="number"
				bind:value={costOverrides.mountingPrice}
				step="0.01"
				min="0"
				class="w-24 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
			/>
		</div>
		<div class="flex items-center justify-between gap-2">
			<span>Envío</span>
			{#if shippingCostPending}
				<span class="text-xs text-on-surface-variant/50 italic">Pendiente</span>
			{:else}
				<input
					type="number"
					bind:value={costOverrides.shippingPrice}
					step="0.01"
					min="0"
					class="w-24 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
				/>
			{/if}
		</div>
		<label class="flex cursor-pointer items-center gap-1.5 text-[11px]">
			<input
				type="checkbox"
				bind:checked={shippingCostPending}
				class="h-3 w-3 rounded border-slate-300"
			/>
			<span>Costo de envío pendiente</span>
		</label>
		<div
			class="flex items-center justify-between gap-2 border-t border-outline-variant/30 pt-1.5 font-semibold text-brand-navy"
		>
			<span>Total</span><span class="font-mono">{formatPrice(internalCostTotal)}</span>
		</div>
	</div>
</Disclosure>
