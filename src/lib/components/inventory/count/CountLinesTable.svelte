<script lang="ts" module>
	export interface CountLineEditing {
		lineId: number | null;
		count: string;
		notes: string;
		showNotes: boolean;
		isSaving: boolean;
	}

	export function createEmptyLineEditing(): CountLineEditing {
		return { lineId: null, count: '', notes: '', showNotes: false, isSaving: false };
	}

	export function startLineEditing(line: {
		id: number;
		countedStock: number | null;
		notes: string | null;
	}): CountLineEditing {
		return {
			lineId: line.id,
			count: line.countedStock !== null ? String(line.countedStock) : '',
			notes: line.notes ?? '',
			showNotes: Boolean(line.notes),
			isSaving: false
		};
	}
</script>

<script lang="ts">
	import { Check, Search } from '@lucide/svelte';
	import { AppBadge, DataGrid } from '$lib/components/ui';
	import {
		INVENTORY_COUNT_UI_FILTER_LABELS,
		type InventoryCountUiFilter
	} from '$lib/schemas/inventoryCount';
	import type { InventoryCountLineRow } from '$lib/server/db/queries/inventoryCount';
	import { formatDate } from '$lib/utils';
	import {
		differenceBadgeClass,
		formatDifference,
		getAdjustmentPath,
		isMatchedLine
	} from './countAdjustments';
	import CountLineEditRow from './CountLineEditRow.svelte';

	interface Props {
		lines: InventoryCountLineRow[];
		totalLines: number;
		activeFilter: InventoryCountUiFilter;
		search: string;
		isReadonly: boolean;
		sessionCancelled: boolean;
		editing: CountLineEditing;
		onStartEditing: (line: InventoryCountLineRow) => void;
		onSaveLine: (line: InventoryCountLineRow) => void;
		onStopEditing: () => void;
		onOpenAdjustment: (line: InventoryCountLineRow) => void;
		onAdjustmentChange: (line: InventoryCountLineRow, event: Event) => void;
		isAdjustmentUpdating: (lineId: number) => boolean;
	}

	let {
		lines,
		totalLines,
		activeFilter = $bindable(),
		search = $bindable(),
		isReadonly,
		sessionCancelled,
		editing = $bindable(),
		onStartEditing,
		onSaveLine,
		onStopEditing,
		onOpenAdjustment,
		onAdjustmentChange,
		isAdjustmentUpdating
	}: Props = $props();

	const columns = [
		{ key: 'item', label: 'Ítem' },
		{ key: 'ref', label: 'SKU / Ref' },
		{ key: 'system', label: 'Stock sistema', align: 'right' as const },
		{ key: 'counted', label: 'Stock contado', align: 'right' as const },
		{ key: 'difference', label: 'Diferencia', align: 'right' as const },
		{ key: 'counter', label: 'Contado por' },
		{ key: 'action', label: 'Acción', align: 'right' as const }
	];

	function isEditing(lineId: number) {
		return editing.lineId === lineId;
	}
</script>

<section class="glass-card border border-outline-variant/20 bg-surface-container-low shadow-sm">
	<div
		class="flex flex-col gap-2 border-b border-outline-variant/15 p-3 sm:p-3.5 lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex flex-wrap gap-2">
			{#each Object.entries(INVENTORY_COUNT_UI_FILTER_LABELS) as [filter, label] (filter)}
				<button
					type="button"
					onclick={() => (activeFilter = filter as InventoryCountUiFilter)}
					class={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${activeFilter === filter ? 'bg-brand-navy text-white' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container'}`}
				>
					{label}
				</button>
			{/each}
		</div>

		<div class="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
			<div class="relative min-w-0 flex-1 lg:w-[22rem] lg:flex-none">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-outline"
				/>
				<input
					type="search"
					bind:value={search}
					placeholder="Buscar por nombre, SKU o referencia"
					class="w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-2.5 pl-10 text-sm text-on-surface"
				/>
			</div>
			<span class="text-xs text-on-surface-variant">{lines.length} / {totalLines}</span>
		</div>
	</div>

	<DataGrid
		{columns}
		items={lines}
		page={1}
		perPage={Math.max(lines.length, 1)}
		total={lines.length}
		totalPages={1}
		itemLabel="líneas"
		emptyTitle="Sin ítems para este filtro"
		emptySubtitle="Ajusta los filtros o registra conteos para ver resultados"
		onPageChange={() => {}}
	>
		{#snippet row(line)}
			{@const adjustmentPath = getAdjustmentPath(line)}
			{@const matched = isMatchedLine(line)}
			<tr
				class="bg-surface-container-lowest text-sm text-on-surface transition-colors hover:bg-surface-container-low"
			>
				<td class="px-4 py-3 align-top">
					<p class="font-semibold text-brand-navy">{line.itemName}</p>
					{#if line.notes}
						<p class="mt-1 text-xs text-on-surface-variant">{line.notes}</p>
					{/if}
				</td>
				<td class="px-4 py-3 align-top font-mono text-xs text-on-surface-variant">
					{line.itemCode ?? '—'}
				</td>
				<td class="px-4 py-3 text-right font-semibold text-brand-navy">{line.systemStock}</td>
				<td class="px-4 py-3 text-right">
					{#if isEditing(line.id)}
						<CountLineEditRow
							layout="desktop"
							bind:count={editing.count}
							bind:notes={editing.notes}
							bind:showNotes={editing.showNotes}
							isSaving={editing.isSaving}
							onSave={() => onSaveLine(line)}
							onCancel={onStopEditing}
						/>
					{:else if line.countedStock !== null}
						{#if !isReadonly}
							<button
								type="button"
								onclick={() => onStartEditing(line)}
								class="ml-auto inline-flex flex-col items-end rounded-lg text-right transition-colors hover:text-brand-navy"
							>
								<span class="font-semibold text-brand-navy">{line.countedStock}</span>
								<span class="text-xs text-on-surface-variant"
									>✓ {line.countedByName ?? 'Usuario'}</span
								>
							</button>
						{:else}
							<div class="space-y-1 text-right">
								<p class="font-semibold text-brand-navy">{line.countedStock}</p>
								<p class="text-xs text-on-surface-variant">✓ {line.countedByName ?? 'Usuario'}</p>
							</div>
						{/if}
					{:else}
						<span class="text-on-surface-variant">—</span>
					{/if}
				</td>
				<td class="px-4 py-3 text-right">
					{#if line.countedStock === null}
						<span class="text-on-surface-variant">—</span>
					{:else}
						<span
							class={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${differenceBadgeClass(line.difference)}`}
						>
							{formatDifference(line.difference)}
						</span>
					{/if}
				</td>
				<td class="px-4 py-3 text-on-surface-variant">
					{line.countedByName ?? '—'}
				</td>
				<td class="px-4 py-3 text-right">
					{#if isEditing(line.id)}
						<span class="text-on-surface-variant">—</span>
					{:else if line.countedStock === null}
						{#if !isReadonly}
							<button
								type="button"
								onclick={() => onStartEditing(line)}
								class="inline-flex items-center gap-2 rounded-lg bg-surface-container px-3 py-1.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high"
							>
								Contar
							</button>
						{:else}
							<span class="text-on-surface-variant">—</span>
						{/if}
					{:else if matched}
						<span class="inline-flex items-center gap-1 text-xs font-semibold text-success">
							<Check class="h-3.5 w-3.5" />
							OK
						</span>
					{:else if adjustmentPath}
						<div class="flex flex-col items-end gap-1.5">
							<button
								type="button"
								onclick={() => onOpenAdjustment(line)}
								class="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue transition-colors hover:text-brand-navy"
							>
								{isReadonly ? 'Revisar ajuste ↗' : 'Ir a ajustar ↗'}
							</button>
							{#if !sessionCancelled}
								<label
									class="flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant"
								>
									<input
										type="checkbox"
										checked={line.adjustmentCompleted}
										disabled={isAdjustmentUpdating(line.id)}
										onchange={(event) => onAdjustmentChange(line, event)}
										class="h-3.5 w-3.5 rounded border border-outline-variant/35 text-brand-blue focus:ring-2 focus:ring-brand-blue/25"
									/>
									<span>Hecho</span>
								</label>
							{/if}
							{#if line.adjustmentCompleted}
								<span class="text-[11px] font-medium text-success">Ajustado</span>
							{/if}
						</div>
					{:else if !isReadonly}
						<button
							type="button"
							onclick={() => onStartEditing(line)}
							class="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue transition-colors hover:text-brand-navy"
						>
							Contar
						</button>
					{:else}
						<span class="text-on-surface-variant">—</span>
					{/if}
				</td>
			</tr>
		{/snippet}

		{#snippet mobileCard(line)}
			{@const adjustmentPath = getAdjustmentPath(line)}
			{@const matched = isMatchedLine(line)}
			<div class="space-y-3">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="font-semibold text-brand-navy">{line.itemName}</p>
						<p class="mt-1 font-mono text-xs text-on-surface-variant">{line.itemCode ?? '—'}</p>
					</div>
					<AppBadge
						variant={line.difference && line.difference !== 0
							? line.difference > 0
								? 'success'
								: 'error'
							: 'neutral'}
					>
						{formatDifference(line.difference)}
					</AppBadge>
				</div>

				<div class="grid grid-cols-2 gap-3 text-sm">
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Sistema
						</p>
						<p class="mt-1 font-semibold text-brand-navy">{line.systemStock}</p>
					</div>
					<div>
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Contado
						</p>
						{#if isEditing(line.id)}
							<CountLineEditRow
								layout="mobile"
								bind:count={editing.count}
								isSaving={editing.isSaving}
								onSave={() => onSaveLine(line)}
								onCancel={onStopEditing}
							/>
						{:else if line.countedStock !== null && !isReadonly}
							<button
								type="button"
								onclick={() => onStartEditing(line)}
								class="mt-1 font-semibold text-brand-navy"
							>
								{line.countedStock}
							</button>
						{:else}
							<p class="mt-1 font-semibold text-brand-navy">{line.countedStock ?? '—'}</p>
						{/if}
					</div>
				</div>

				{#if isEditing(line.id)}
					<div class="space-y-2">
						<button
							type="button"
							onclick={() => (editing.showNotes = !editing.showNotes)}
							class="text-xs font-semibold text-brand-blue transition-colors hover:text-brand-navy"
						>
							{editing.showNotes ? 'Ocultar nota' : 'Agregar nota'}
						</button>
						{#if editing.showNotes}
							<textarea
								bind:value={editing.notes}
								rows="2"
								class="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-on-surface"
								placeholder="Nota opcional"></textarea>
						{/if}
					</div>
				{:else if adjustmentPath}
					<div class="space-y-2">
						<button
							type="button"
							onclick={() => onOpenAdjustment(line)}
							class="inline-flex w-full items-center justify-center rounded-xl bg-surface-container px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high"
						>
							{isReadonly ? 'Revisar ajuste ↗' : 'Ajustar →'}
						</button>
						{#if !sessionCancelled}
							<label
								class="flex items-center gap-2 rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface-variant"
							>
								<input
									type="checkbox"
									checked={line.adjustmentCompleted}
									disabled={isAdjustmentUpdating(line.id)}
									onchange={(event) => onAdjustmentChange(line, event)}
									class="h-4 w-4 rounded border border-outline-variant/35 text-brand-blue focus:ring-2 focus:ring-brand-blue/25"
								/>
								<span>Hecho</span>
							</label>
						{/if}
						{#if line.adjustmentCompletedAt}
							<p class="text-xs text-on-surface-variant">
								{line.adjustmentCompletedByName ?? 'Usuario'} ·
								{formatDate(line.adjustmentCompletedAt, {
									dateStyle: 'short',
									timeStyle: 'short'
								})}
							</p>
						{/if}
					</div>
				{:else if matched}
					<div
						class="rounded-xl bg-success-container/60 px-3 py-3 text-sm font-semibold text-success"
					>
						Conteo OK
					</div>
				{:else if !isReadonly}
					<div class="space-y-2">
						<button
							type="button"
							onclick={() => onStartEditing(line)}
							class="w-full rounded-xl border border-outline-variant/35 bg-surface-container px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high"
						>
							{line.countedStock === null ? 'Contar' : 'Editar conteo'}
						</button>
					</div>
				{/if}
			</div>
		{/snippet}
	</DataGrid>
</section>
