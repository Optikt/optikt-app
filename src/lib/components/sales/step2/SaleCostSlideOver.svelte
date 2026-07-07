<script lang="ts">
	import { X } from '@lucide/svelte';
	import { SlideOver } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';

	interface Props {
		open: boolean;
		costOverrides: import('../newSaleTypes').CostOverrides;
		shippingCostPending: boolean;
		eyeCount: number;
	}

	let {
		open = $bindable(),
		costOverrides = $bindable(),
		shippingCostPending = $bindable(),
		eyeCount
	}: Props = $props();

	const effectiveShipping = $derived(shippingCostPending ? 0 : costOverrides.shippingPrice);
	const internalCostTotal = $derived(
		costOverrides.baseCost + costOverrides.mountingPrice + effectiveShipping
	);
</script>

<SlideOver bind:open size="lg">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
			<p class="text-sm font-semibold text-brand-navy">Costo interno</p>
			<button
				type="button"
				onclick={onclose}
				class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-container-high hover:text-slate-600"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/snippet}

	<div class="space-y-3 text-sm text-on-surface-variant">
		<div class="flex items-center justify-between gap-2">
			<span>Cristales × {eyeCount}</span>
			<input
				type="number"
				bind:value={costOverrides.baseCost}
				step="0.01"
				min="0"
				class="w-28 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
			/>
		</div>
		<div class="flex items-center justify-between gap-2">
			<span>Montaje</span>
			<input
				type="number"
				bind:value={costOverrides.mountingPrice}
				step="0.01"
				min="0"
				class="w-28 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
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
					class="w-28 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
				/>
			{/if}
		</div>
		<label class="flex cursor-pointer items-center gap-1.5 text-xs">
			<input
				type="checkbox"
				bind:checked={shippingCostPending}
				class="h-3 w-3 rounded border-slate-300"
			/>
			<span>Costo de envío pendiente</span>
		</label>
		<div
			class="flex items-center justify-between gap-2 border-t border-outline-variant/30 pt-2 font-semibold text-brand-navy"
		>
			<span>Total</span>
			<span class="font-mono">{formatPrice(internalCostTotal)}</span>
		</div>
	</div>
</SlideOver>
