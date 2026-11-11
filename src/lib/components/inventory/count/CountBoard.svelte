<script lang="ts">
	import ItemCell from './ui/ItemCell.svelte';
	import CountVirtualList from './CountVirtualList.svelte';
	import { finalCount as finalCountHelper } from '$lib/shared/inventoryCount';
	import type { CountLineRow } from '$lib/server/db/queries/inventoryCount/types';
	import type { CountCycleConfig } from '$lib/shared/inventoryCount';

	interface Props {
		lines: CountLineRow[];
		config: CountCycleConfig;
		costByLineId: Map<number, number | null>;
		canCount: boolean;
		/** Líneas con un guard en vuelo (visual readonly mientras se guardan). */
		savingLineIds?: Set<number>;
		onSaveLine: (lineId: number, value: number) => void;
		onConfirmZero: () => void;
		isMobile: boolean;
		mode: 'ficha' | 'lista';
	}

	let {
		lines,
		config,
		costByLineId,
		canCount,
		savingLineIds = new Set(),
		onSaveLine,
		onConfirmZero,
		isMobile,
		mode
	}: Props = $props();

	// ── Ficha (teléfono) ─────────────────────────────────────────────────────

	let fichaIndex = $state(0);

	const fichaOrder = $derived.by(() => {
		const withStock = lines.filter((line) => line.systemStock > 0).map((line) => line.id);
		const zero = lines.filter((line) => line.systemStock === 0).map((line) => line.id);
		return [...withStock, ...zero];
	});
	const fichaLine = $derived.by(() => {
		const id = fichaOrder[Math.min(fichaIndex, fichaOrder.length - 1)];
		return lines.find((line) => line.id === id) ?? null;
	});

	function goToNextFicha(): void {
		const currentId = fichaLine?.id;
		if (currentId == null) return;
		const currentPos = fichaOrder.indexOf(currentId);
		const nextPos = fichaOrder.findIndex(
			(id, index) => index > currentPos && lines.find((l) => l.id === id)?.countedStock == null
		);
		if (nextPos >= 0) fichaIndex = nextPos;
		else if (currentPos < fichaOrder.length - 1) fichaIndex = currentPos + 1;
	}

	function goToPrevFicha(): void {
		fichaIndex = Math.max(0, fichaIndex - 1);
	}

	function saveLine(line: CountLineRow, raw: string): void {
		if (raw === '') return;
		const numeric = Number.parseInt(raw, 10);
		if (!Number.isInteger(numeric) || numeric < 0) return;
		onSaveLine(line.id, numeric);
	}
</script>

{#if isMobile && mode === 'ficha'}
	{#if fichaLine}
		<div class="px-4 py-8 text-center">
			<p class="text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
				{fichaLine.brandName} · ficha {Math.min(fichaIndex + 1, fichaOrder.length)} de {fichaOrder.length}
			</p>
			<p class="mt-1">
				<ItemCell
					itemName={fichaLine.itemName}
					itemCode={fichaLine.itemCode}
					itemType={fichaLine.itemType}
					productId={fichaLine.productId}
					lensCatalogItemId={fichaLine.lensCatalogItemId}
					nameClass="font-heading text-2xl font-bold"
				/>
			</p>
			<p class="font-mono text-xs text-outline">{fichaLine.itemCode ?? ''}</p>
			<p class="mt-6 text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
				Sistema
			</p>
			<p class="font-heading text-[56px] leading-none font-bold text-brand-navy">
				{fichaLine.systemStock}
			</p>
			<p class="mt-4 text-xs font-bold tracking-[0.06em] text-on-surface-variant uppercase">
				Contado
			</p>
			<input
				type="text"
				inputmode="numeric"
				enterkeyhint="next"
				aria-label="Contado {fichaLine.itemName}"
				value={finalCountHelper(fichaLine) ?? ''}
				disabled={!canCount}
				readonly={savingLineIds.has(fichaLine.id)}
				aria-busy={savingLineIds.has(fichaLine.id)}
				class="mx-auto mt-1 block w-40 rounded-xl border border-outline-variant/40 bg-white px-3 py-3 text-center text-4xl font-bold {savingLineIds.has(
					fichaLine.id
				)
					? 'opacity-70'
					: ''}"
				oninput={(event) => {
					const input = event.currentTarget as HTMLInputElement;
					input.value = input.value.replace(/\D/g, '').slice(0, 4);
				}}
				onchange={(event) => saveLine(fichaLine, (event.currentTarget as HTMLInputElement).value)}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						saveLine(fichaLine, (event.currentTarget as HTMLInputElement).value);
						goToNextFicha();
					}
				}}
			/>
			<div class="mt-4 flex gap-3 px-4">
				<button
					type="button"
					class="flex-1 rounded-lg bg-surface-container py-3.5 text-sm font-semibold text-brand-navy"
					onclick={goToPrevFicha}
				>
					← Anterior
				</button>
				<button
					type="button"
					class="flex-1 rounded-lg bg-brand-gold py-3.5 text-sm font-semibold text-brand-navy"
					onclick={() => goToNextFicha()}
				>
					Guardar y siguiente
				</button>
			</div>
		</div>
	{:else}
		<p class="p-10 text-center text-sm text-on-surface-variant">Sin ítems en la ficha</p>
	{/if}
{:else}
	<CountVirtualList
		{lines}
		{config}
		{costByLineId}
		{canCount}
		{savingLineIds}
		{onSaveLine}
		{onConfirmZero}
	/>
{/if}
