<script lang="ts">
	import { X, Check } from '@lucide/svelte';
	import { SlideOver } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';
	import { untrack } from 'svelte';

	interface Props {
		open: boolean;
		initialCost: number;
		ineyeCount: number;
		onapply: (newCost: number) => void;
	}

	let { open = $bindable(), initialCost, ineyeCount, onapply }: Props = $props();

	let draftCost = $state(initialCost);

	$effect(() => {
		if (open) {
			draftCost = untrack(() => initialCost);
		}
	});

	function handleApply() {
		onapply(draftCost);
		open = false;
	}

	function handleCancel() {
		open = false;
	}
</script>

<SlideOver bind:open size="md">
	{#snippet header({ onclose: hclose })}
		<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
			<p class="text-sm font-semibold text-brand-navy">Costo del filtro</p>
			<button
				type="button"
				onclick={hclose}
				class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-container-high hover:text-slate-600"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/snippet}

	<div class="space-y-3 text-sm text-on-surface-variant">
		<div class="flex items-center justify-between gap-2">
			<span>Filtros × {ineyeCount}</span>
			<input
				type="number"
				bind:value={draftCost}
				step="0.01"
				min="0"
				class="w-28 rounded-lg border bg-surface px-2 py-1.5 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none border-outline-variant/40"
			/>
		</div>
		<div
			class="flex items-center justify-between gap-2 border-t border-outline-variant/30 pt-2 font-semibold text-brand-navy"
		>
			<span>Total costo</span>
			<span class="font-mono">{formatPrice(draftCost * ineyeCount)}</span>
		</div>
	</div>

	{#snippet footer()}
		<div class="border-t border-slate-200 px-6 py-3">
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
					class="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-navy/90"
				>
					<Check class="h-3.5 w-3.5" />
					Aceptar
				</button>
			</div>
		</div>
	{/snippet}
</SlideOver>
