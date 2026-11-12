<script lang="ts">
	import ItemCell from './ui/ItemCell.svelte';
	import { CheckCheck, Clock } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import StatusIcon from './ui/StatusIcon.svelte';
	import DiffBadge from './ui/DiffBadge.svelte';
	import {
		ADJUSTMENT_REASON_LABELS,
		ALL_ADJUSTMENT_REASONS,
		AdjustmentReason
	} from '$lib/shared/enums';
	import { formatUsd, finalCount, type CountCycleConfig } from '$lib/shared/inventoryCount';
	import type { CountLineRow } from '$lib/server/db/queries/inventoryCount/types';

	interface Row {
		line: CountLineRow;
		/** Diferencia final ya calculada por el padre. */
		diff: number;
	}

	interface Props {
		rows: Row[];
		config: CountCycleConfig;
		costByLineId: Map<number, number | null>;
		canReview: boolean;
		isBusy: boolean;
		/** N de líneas ajustables en lote (para «Ajustar todo (N)»). */
		batchCount: number;
		reason: AdjustmentReason;
		reasonText: string;
		onRequestBatch: () => void;
		onRecount: (line: CountLineRow, raw: string) => void | Promise<void>;
		onOpenAdjust: (line: CountLineRow) => void;
		/** Quita la solicitud de ajuste de una línea (vuelve a «Ajustar»). */
		onClearAdjust: (line: CountLineRow) => void;
	}

	let {
		rows,
		config,
		costByLineId,
		canReview,
		isBusy,
		batchCount,
		onRequestBatch,
		onRecount,
		onOpenAdjust,
		onClearAdjust,
		reason = $bindable(AdjustmentReason.PHYSICAL_COUNT),
		reasonText = $bindable('')
	}: Props = $props();

	function impactOf(line: CountLineRow, diff: number): number {
		const cost = costByLineId.get(line.id) ?? 0;
		return diff * cost;
	}

	function gravityHigh(line: CountLineRow, diff: number): boolean {
		const cost = costByLineId.get(line.id) ?? null;
		const unitsHigh = Math.abs(diff) >= config.diffThresholdUnits;
		const usdHigh =
			config.diffThresholdUsd > 0 &&
			cost != null &&
			Math.abs(diff * cost) >= config.diffThresholdUsd;
		return unitsHigh || usdHigh;
	}
</script>

<section
	class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-[var(--ds-shadow-md)]"
>
	<div class="flex flex-wrap items-center gap-3 border-b border-outline-variant/40 px-4 py-3">
		<b class="text-brand-navy">Diferencias por impacto</b>
		<span class="text-xs text-on-surface-variant">orden de mayor a menor impacto</span>
		<span class="flex-1"></span>
		{#if canReview}
			<TriggerTooltip
				title={`Ajustar todo (${batchCount})`}
				text={`Deja ${batchCount} diferencia(s) bajo el umbral (${config.diffThresholdUnits} unidades${config.diffThresholdUsd > 0 ? ` y ${config.diffThresholdUsd} USD` : ''}) marcadas para el cierre: los movimientos se crean al cerrar la sesión. Las que superan el umbral se piden una por una tras el recuento.`}
				side="bottom"
			>
				{#snippet trigger({ props })}
					<button
						{...props}
						type="button"
						aria-disabled={batchCount === 0}
						class={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
							batchCount === 0
								? 'cursor-not-allowed bg-surface-container text-on-surface-variant opacity-60'
								: 'bg-brand-navy text-white hover:bg-brand-navy-dark'
						}`}
						onclick={(event) => {
							if (batchCount === 0) {
								event.preventDefault();
								return;
							}
							onRequestBatch();
						}}
					>
						Ajustar todo ({batchCount})
					</button>
				{/snippet}
			</TriggerTooltip>
			<select
				aria-label="Motivo del ajuste"
				bind:value={reason}
				class="rounded-lg border border-outline-variant/40 bg-white px-2 py-1.5 text-sm"
			>
				{#each ALL_ADJUSTMENT_REASONS as option (option)}
					<option value={option}>{ADJUSTMENT_REASON_LABELS[option]}</option>
				{/each}
			</select>
			{#if reason === 'OTHER'}
				<input
					type="text"
					placeholder="Describe el motivo"
					bind:value={reasonText}
					class="rounded-lg border border-outline-variant/40 bg-white px-2 py-1.5 text-sm"
					aria-label="Texto del motivo"
				/>
			{/if}
		{/if}
	</div>

	{#if rows.length === 0}
		<div class="px-6 py-10 text-center text-sm text-on-surface-variant">
			<b class="text-brand-navy">Sin diferencias</b>
			<span class="block">Todo coincide con el sistema</span>
		</div>
	{:else}
		<div class="overflow-auto">
			<table class="w-full table-fixed text-sm">
				<thead
					class="sticky top-0 z-10 bg-surface-container-high text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
				>
					<tr>
						<th class="w-[26px] px-2"></th>
						<th class="px-2 text-left font-semibold">Ítem</th>
						<th class="px-2 text-right font-semibold">Sistema → Contado</th>
						<th class="px-2 text-right font-semibold">Dif.</th>
						<th class="px-2 text-right font-semibold">Impacto</th>
						<th class="w-[190px] px-2 text-right font-semibold">Acción</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.line.id)}
						{@const line = row.line}
						<tr class="border-t border-outline-variant/40 align-middle">
							<td class="px-2 py-2.5">
								<StatusIcon
									{line}
									diffThresholdUnits={config.diffThresholdUnits}
									diffThresholdUsd={config.diffThresholdUsd}
									unitCost={costByLineId.get(line.id) ?? null}
									size="sm"
								/>
							</td>
							<td class="px-2 py-2.5">
								<ItemCell
									itemName={line.itemName}
									itemCode={line.itemCode}
									itemType={line.itemType}
									productId={line.productId}
									lensCatalogItemId={line.lensCatalogItemId}
								/>
								<span class="block truncate font-mono text-xs text-outline"
									>{line.itemCode ?? ''}</span
								>
							</td>
							<td class="px-2 py-2.5 text-right text-on-surface-variant tabular-nums">
								{line.systemStock} → {finalCount(line) ?? '—'}
							</td>
							<td class="px-2 py-2.5 text-right">
								<DiffBadge
									diff={row.diff}
									gravity={gravityHigh(line, row.diff) ? 'high' : 'low'}
									systemStock={line.systemStock}
									counted={finalCount(line)}
									stateTitle={row.diff > 0 ? `Sobran ${row.diff}` : `Falta ${Math.abs(row.diff)}`}
								/>
							</td>
							<td class="px-2 py-2.5 text-right text-on-surface-variant tabular-nums">
								{formatUsd(impactOf(line, row.diff))}
							</td>
							<td class="px-2 py-2.5 text-right">
								{#if !canReview}
									<span class="text-xs text-on-surface-variant">—</span>
								{:else if line.adjustmentMovementId != null}
									<span class="inline-flex items-center gap-1 text-xs font-semibold text-[#1e4f5e]">
										<CheckCheck class="h-4 w-4" />
										Ajustado
									</span>
								{:else if line.adjustmentRequestedAt != null}
									<span
										class="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant"
									>
										<Clock class="h-4 w-4" />
										Al cierre
									</span>
									<button
										type="button"
										aria-label={`Quitar ajuste de ${line.itemName}`}
										disabled={isBusy}
										class="ml-1 rounded px-1.5 py-0.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container hover:text-brand-navy disabled:opacity-60"
										onclick={() => onClearAdjust(line)}
									>
										✕
									</button>
								{:else if gravityHigh(line, row.diff) && line.recountedStock == null}
									<input
										type="text"
										inputmode="numeric"
										placeholder="Recontar"
										aria-label={`Recontar ${line.itemName}`}
										disabled={isBusy}
										enterkeyhint="done"
										class="w-24 rounded-lg border border-outline-variant/40 bg-white px-2 py-1.5 text-right font-semibold tabular-nums focus:ring-2 focus:ring-brand-blue/50 focus:outline-none"
										onchange={(event) => {
											const input = event.currentTarget as HTMLInputElement;
											// Tras Enter el valor ya viajó: no repetir si el blur llega antes del render.
											if (input.dataset.synced === input.value) {
												delete input.dataset.synced;
												return;
											}
											void onRecount(line, input.value);
										}}
										onkeydown={(event) => {
											if (event.key === 'Enter') {
												event.preventDefault();
												const input = event.currentTarget as HTMLInputElement;
												input.dataset.synced = input.value;
												void onRecount(line, input.value);
											}
										}}
									/>
								{:else}
									{#if line.recountedStock != null}
										<span class="mr-1 text-xs font-semibold text-brand-navy">Recontado ·</span>
									{/if}
									<button
										type="button"
										class="rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-navy-dark"
										onclick={() => onOpenAdjust(line)}
									>
										Ajustar
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
