<script lang="ts">
	import { SlideOver } from '$lib/components/ui';
	import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';
	import type { CountCycleConfig } from '$lib/shared/inventoryCount';

	interface Props {
		open: boolean;
		config: CountCycleConfig;
		onClose: () => void;
		onSave: (config: CountCycleConfig) => void;
	}

	let { open = $bindable(false), config, onClose, onSave }: Props = $props();

	let cycleDays = $state(config.cycleDays);
	let diffThresholdUnits = $state(config.diffThresholdUnits);
	let diffThresholdUsd = $state(config.diffThresholdUsd);
	let quickOldestLimit = $state(config.quickOldestLimit);

	const canSave = $derived(
		Number.isFinite(cycleDays) &&
			cycleDays >= 1 &&
			Number.isFinite(diffThresholdUnits) &&
			diffThresholdUnits >= 0 &&
			Number.isFinite(diffThresholdUsd) &&
			diffThresholdUsd >= 0 &&
			Number.isFinite(quickOldestLimit) &&
			quickOldestLimit >= 1
	);
</script>

<SlideOver bind:open onclose={onClose} size="md">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
			<h2 class="font-heading text-lg font-semibold text-brand-navy">Ajustes del ciclo</h2>
			<button
				type="button"
				aria-label="Cerrar"
				class="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-low"
				onclick={onclose}
			>
				✕
			</button>
		</div>
	{/snippet}

	<div class="space-y-4 px-4 py-4">
		<label class="block">
			<span class="flex items-center gap-2">
				<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
					Plazo del ciclo (días)
				</span>
				<InfoTooltip text="Plazo|Cada ítem debería contarse dentro de este plazo." />
			</span>
			<input
				type="number"
				bind:value={cycleDays}
				min="1"
				max="365"
				class="mt-1 w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm"
			/>
		</label>

		<label class="block">
			<span class="flex items-center gap-2">
				<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
					Umbral de diferencia (unidades)
				</span>
				<InfoTooltip text="Umbral|Desde aquí la diferencia se marca en rojo y exige recuento." />
			</span>
			<input
				type="number"
				bind:value={diffThresholdUnits}
				min="0"
				max="100"
				class="mt-1 w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm"
			/>
		</label>

		<label class="block">
			<span class="flex items-center gap-2">
				<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
					Umbral de diferencia (USD · 0 = desactivado)
				</span>
				<InfoTooltip
					text="Umbral USD|También marca en rojo si |dif × costo| supera este valor (costo FIFO). 0 lo desactiva."
				/>
			</span>
			<input
				type="number"
				step="0.01"
				min="0"
				bind:value={diffThresholdUsd}
				class="mt-1 w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm"
			/>
		</label>

		<label class="block">
			<span class="flex items-center gap-2">
				<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
					«Más atrasados» · N
				</span>
				<InfoTooltip text="Atajo|Cuántos ítems toma «Los más atrasados» (25, 50, 100…)." />
			</span>
			<input
				type="number"
				bind:value={quickOldestLimit}
				min="1"
				max="500"
				class="mt-1 w-full rounded-lg border border-outline-variant/35 bg-white px-3 py-2 text-sm"
			/>
		</label>

		<p class="text-sm text-on-surface-variant">
			Global. Verde hasta 75 % del plazo, ámbar hasta 100 % y rojo después.
		</p>
	</div>

	{#snippet footer()}
		<div class="flex justify-end border-t border-outline-variant/30 px-4 py-3">
			<button
				type="button"
				disabled={!canSave}
				class="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-60"
				onclick={() =>
					onSave({
						cycleDays: Number(cycleDays),
						diffThresholdUnits: Number(diffThresholdUnits),
						diffThresholdUsd: Number(diffThresholdUsd),
						quickOldestLimit: Number(quickOldestLimit)
					})}
			>
				Listo
			</button>
		</div>
	{/snippet}
</SlideOver>
