<script lang="ts">
	import { AppBadge } from '$lib/components/ui';
	import type { InventoryCountLineRow } from '$lib/server/db/queries/inventoryCount';
	import { formatDate } from '$lib/utils';
	import { formatDifference, getAdjustmentPath, isMatchedLine } from './countAdjustments';
	import CountLineEditRow, { type CountLineEditing } from './CountLineEditRow.svelte';

	interface Props {
		line: InventoryCountLineRow;
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
		line,
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

	const adjustmentPath = $derived(getAdjustmentPath(line));
	const matched = $derived(isMatchedLine(line));
	const isEditing = $derived(editing.lineId === line.id);
</script>

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
			<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">Sistema</p>
			<p class="mt-1 font-semibold text-brand-navy">{line.systemStock}</p>
		</div>
		<div>
			<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">Contado</p>
			{#if isEditing}
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

	{#if isEditing}
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
		<div class="rounded-xl bg-success-container/60 px-3 py-3 text-sm font-semibold text-success">
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
