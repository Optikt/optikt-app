<script lang="ts">
	import { ALL_ADJUSTMENT_REASONS } from '$lib/shared/enums';
	import { ADJUSTMENT_REASON_LABELS, AdjustmentReason } from '$lib/shared/enums';
	import { lineDiff, formatUsd } from '$lib/shared/inventoryCount';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import type { CountLineRow } from '$lib/server/db/queries/inventoryCount/types';

	interface Props {
		/** Línea en ajuste (null = cerrar). */
		target: CountLineRow | null;
		unitCost: number | null;
		isBusy: boolean;
		reason: AdjustmentReason;
		reasonText: string;
		onclose: () => void;
		onApply: (line: CountLineRow) => void;
	}

	let {
		target,
		unitCost,
		isBusy,
		reason = $bindable(AdjustmentReason.PHYSICAL_COUNT),
		reasonText = $bindable(''),
		onclose,
		onApply
	}: Props = $props();

	const diff = $derived(target ? (lineDiff(target) ?? 0) : 0);
	const direction = $derived(diff > 0 ? 'in' : 'out');
</script>

<SlideOver open={target != null} {onclose} size="md">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
			<h2 class="font-heading text-lg font-semibold text-brand-navy">Ajustar stock</h2>
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

	{#if target}
		<div class="space-y-3 px-4 py-4">
			<div>
				<b class="text-brand-navy">{target.itemName}</b>
				<span class="block font-mono text-xs text-outline">{target.itemCode ?? ''}</span>
			</div>
			<span
				class={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
					direction === 'in'
						? 'bg-warning-container text-on-warning-container'
						: 'bg-error-container text-on-error-container'
				}`}
			>
				{direction === 'in' ? 'Entrada' : 'Salida'} de {Math.abs(diff)} u · {formatUsd(
					diff * (unitCost ?? 0)
				)}
			</span>

			<label class="block">
				<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase"
					>Motivo</span
				>
				<select
					bind:value={reason}
					class="mt-1 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm"
				>
					{#each ALL_ADJUSTMENT_REASONS as option (option)}
						<option value={option}>{ADJUSTMENT_REASON_LABELS[option]}</option>
					{/each}
				</select>
			</label>
			{#if reason === AdjustmentReason.OTHER}
				<label class="block">
					<span class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
						Descripción
					</span>
					<input
						type="text"
						bind:value={reasonText}
						class="mt-1 w-full rounded-lg border border-outline-variant/40 bg-white px-3 py-2 text-sm"
						placeholder="Describe el motivo"
						aria-label="Texto del motivo"
					/>
				</label>
			{/if}
			<p class="text-xs text-on-surface-variant">
				Se vincula un movimiento de inventario a esta línea del conteo.
			</p>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex justify-end gap-2 border-t border-outline-variant/30 px-4 py-3">
			<button
				type="button"
				class="rounded-lg px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
				onclick={onclose}
			>
				Cancelar
			</button>
			<button
				type="button"
				aria-disabled={isBusy || !target}
				class="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-gold-dark aria-disabled:opacity-60"
				onclick={() => target && onApply(target)}
			>
				Aplicar ajuste
			</button>
		</div>
	{/snippet}
</SlideOver>
