<script lang="ts">
	import { X, Check } from '@lucide/svelte';
	import { SlideOver } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';
	import { autoAnimate } from '@formkit/auto-animate';
	import type { CostOverrides } from '../newSaleTypes';

	interface Props {
		open: boolean;
		costOverrides: CostOverrides;
		shippingCostPending: boolean;
		eyeCount: number;
	}

	let { open = $bindable(), costOverrides, shippingCostPending, eyeCount }: Props = $props();

	function cloneCost(c: CostOverrides): CostOverrides {
		return { baseCost: c.baseCost, mountingPrice: c.mountingPrice, shippingPrice: c.shippingPrice };
	}

	let draftCost = $state<CostOverrides>(cloneCost(costOverrides));
	let draftShipPending = $state(false);

	$effect(() => {
		if (open) {
			draftCost = cloneCost(costOverrides);
			draftShipPending = shippingCostPending;
		}
	});

	const effectiveShipping = $derived(draftShipPending ? 0 : draftCost.shippingPrice);
	const internalCostTotal = $derived(
		draftCost.baseCost + draftCost.mountingPrice + effectiveShipping
	);

	const costErrs = $derived.by((): Record<string, string> => {
		const errs: Record<string, string> = {};
		if (draftCost.baseCost == null || Number.isNaN(draftCost.baseCost)) {
			errs.baseCost = 'Costo base es requerido';
		}
		if (draftCost.mountingPrice == null || Number.isNaN(draftCost.mountingPrice)) {
			errs.mountingPrice = 'Costo de montaje es requerido';
		}
		if (
			!draftShipPending &&
			(draftCost.shippingPrice == null || Number.isNaN(draftCost.shippingPrice))
		) {
			errs.shippingPrice = 'Costo de envío es requerido';
		}
		return errs;
	});

	const costValid = $derived(Object.keys(costErrs).length === 0);

	function handleApply() {
		costOverrides.baseCost = draftCost.baseCost;
		costOverrides.mountingPrice = draftCost.mountingPrice;
		costOverrides.shippingPrice = draftCost.shippingPrice;
		shippingCostPending = draftShipPending;
		open = false;
	}

	function handleCancel() {
		open = false;
	}
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
				bind:value={draftCost.baseCost}
				step="0.01"
				min="0"
				class="w-28 rounded-lg border bg-surface px-2 py-1.5 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none {costErrs.baseCost
					? 'border-red-300'
					: 'border-outline-variant/40'}"
			/>
		</div>
		<div class="flex items-center justify-between gap-2">
			<span>Montaje</span>
			<input
				type="number"
				bind:value={draftCost.mountingPrice}
				step="0.01"
				min="0"
				class="w-28 rounded-lg border bg-surface px-2 py-1.5 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none {costErrs.mountingPrice
					? 'border-red-300'
					: 'border-outline-variant/40'}"
			/>
		</div>
		<div class="flex items-center justify-between gap-2">
			<span>Envío</span>
			{#if draftShipPending}
				<span class="text-xs text-on-surface-variant/50 italic">Pendiente</span>
			{:else}
				<input
					type="number"
					bind:value={draftCost.shippingPrice}
					step="0.01"
					min="0"
					class="w-28 rounded-lg border bg-surface px-2 py-1.5 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none {costErrs.shippingPrice
						? 'border-red-300'
						: 'border-outline-variant/40'}"
				/>
			{/if}
		</div>
		<label class="flex cursor-pointer items-center gap-1.5 text-xs">
			<input
				type="checkbox"
				bind:checked={draftShipPending}
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

	{#snippet footer()}
		<div class="border-t border-slate-200 px-6 py-3">
			{#if !costValid}
				<div class="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" use:autoAnimate>
					<p class="mb-1 font-semibold">
						{Object.keys(costErrs).length === 1
							? '1 error pendiente'
							: `${Object.keys(costErrs).length} errores pendientes`}
					</p>
					<ul class="list-inside list-disc space-y-0.5" use:autoAnimate>
						{#each Object.entries(costErrs) as [, msg] (msg)}
							<li class="text-red-600">{msg}</li>
						{/each}
					</ul>
				</div>
			{/if}
			<div class="flex items-center justify-end gap-2">
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
				>
					Cancelar
				</button>
				<button
					type="button"
					onclick={handleApply}
					disabled={!costValid}
					class="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-40"
				>
					<Check class="h-3.5 w-3.5" />
					Aceptar
				</button>
			</div>
		</div>
	{/snippet}
</SlideOver>
