<script lang="ts">
	import { Eye, FlaskConical, Package, Pencil, Sparkles, X } from '@lucide/svelte';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';
	import type { EditableItem } from '../editSaleDraft';

	interface Props {
		activeItems: EditableItem[];
		mainItems: EditableItem[];
		editingLensId: string | null;
		saving: boolean;
		onEditLens: (item: EditableItem) => void;
		onRemoveItem: (item: EditableItem) => void;
	}

	let { activeItems, mainItems, editingLensId, saving, onEditLens, onRemoveItem }: Props = $props();

	function itemDetail(item: EditableItem): string {
		const parts: string[] = [];
		if (item.snapshotSku) parts.push(item.snapshotSku);
		if (item.snapshotBrand) parts.push(item.snapshotBrand);
		if (item.itemType === SaleItemType.FREE_ITEM && item.freeItemCategory)
			parts.push(item.freeItemCategory);
		return parts.join(' · ');
	}
</script>

<div class="space-y-2">
	{#each mainItems as item, i (item.id || i)}
		{@const Icon =
			item.itemType === SaleItemType.LENS_PAIR
				? Eye
				: item.itemType === SaleItemType.FREE_ITEM
					? Sparkles
					: item.itemType === SaleItemType.TREATMENT
						? FlaskConical
						: Package}
		<div
			class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800"
			class:opacity-50={editingLensId === item.id}
		>
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg {item.itemType ===
				SaleItemType.LENS_PAIR
					? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300'
					: item.itemType === SaleItemType.FREE_ITEM
						? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
						: item.itemType === SaleItemType.TREATMENT
							? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
							: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}"
			>
				<Icon class="h-4 w-4" />
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<span class="truncate text-sm font-semibold text-brand-navy dark:text-white">
						{item.itemType === SaleItemType.FREE_ITEM
							? (item.freeItemDescription ?? 'Ítem libre')
							: (item.snapshotName ?? 'Artículo')}
					</span>
					<span
						class="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase {item.itemType ===
						SaleItemType.LENS_PAIR
							? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300'
							: item.itemType === SaleItemType.FREE_ITEM
								? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
								: item.itemType === SaleItemType.TREATMENT
									? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
									: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}"
					>
						{item.itemType === SaleItemType.LENS_PAIR
							? 'Cristal'
							: item.itemType === SaleItemType.FREE_ITEM
								? 'Ítem Libre'
								: item.itemType === SaleItemType.TREATMENT
									? 'Tratamiento'
									: 'Producto'}
					</span>
					{#if !item.id}<span
							class="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-green-700 uppercase dark:bg-green-900/50 dark:text-green-300"
							>Nuevo</span
						>{/if}
				</div>
				{#if itemDetail(item)}<p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
						{itemDetail(item)}
					</p>{/if}
			</div>
			<div class="text-right">
				<p class="font-mono text-sm font-semibold text-brand-navy dark:text-white">
					{formatPrice(item.unitPrice)}
				</p>
				<p class="text-xs text-slate-500 dark:text-slate-400">x{item.quantity}</p>
			</div>
			{#if item.itemType === SaleItemType.LENS_PAIR}
				<button
					type="button"
					onclick={() => onEditLens(item)}
					disabled={!!editingLensId || saving}
					class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-30 dark:hover:bg-cyan-900/30"
					title="Editar cristal"><Pencil class="h-3.5 w-3.5" /></button
				>
			{/if}
			<button
				type="button"
				onclick={() => onRemoveItem(item)}
				disabled={!!editingLensId || saving}
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/30"
				title="Eliminar"><X class="h-4 w-4" /></button
			>
		</div>
		{#if item.itemType === SaleItemType.LENS_PAIR}
			{@const childTreatments = activeItems.filter(
				(ci) => ci.parentSaleItemId === item.id && ci.itemType === SaleItemType.TREATMENT
			)}
			{#each childTreatments as treatment (treatment.id)}
				<div
					class="ml-8 flex items-center gap-3 rounded-lg border border-dashed border-purple-200 bg-purple-50/40 px-4 py-2 dark:border-purple-800 dark:bg-purple-900/20"
				>
					<FlaskConical class="h-3.5 w-3.5 shrink-0 text-purple-500" />
					<span class="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300"
						>{treatment.snapshotName ?? 'Tratamiento'}</span
					>
					<span class="font-mono text-xs text-slate-500 dark:text-slate-400"
						>{formatPrice(treatment.unitPrice)}</span
					>
				</div>
			{/each}
		{/if}
	{/each}
	{#if mainItems.length === 0}<div
			class="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400 dark:border-slate-600"
		>
			No hay artículos en esta venta. Agregue al menos uno.
		</div>{/if}
</div>
