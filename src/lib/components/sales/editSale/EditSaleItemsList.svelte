<script lang="ts">
	import { tick } from 'svelte';
	import { Plus } from '@lucide/svelte';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import DocumentItemRow from '$lib/components/commercialDocument/DocumentItemRow.svelte';
	import {
		formatRxSummary,
		type DocumentItemBadge,
		type DocumentItemTone,
		type DocumentItemView
	} from '$lib/components/commercialDocument/itemView';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { ADD_ITEM_KINDS, type AddItemKind } from './addItemKinds';
	import EditSaleLensEditor from './EditSaleLensEditor.svelte';
	import EditSaleProductEditor from './EditSaleProductEditor.svelte';
	import EditSaleFreeEditor from './EditSaleFreeEditor.svelte';
	import {
		mapTreatmentsForEdit,
		type EditableItem,
		type EditLensTreatment
	} from '../editSaleDraft';

	export type EditorKind = 'lens' | 'product' | 'free';

	interface Props {
		activeItems: EditableItem[];
		mainItems: EditableItem[];
		editingId: string | null;
		editorKind: EditorKind | null;
		creating: boolean;
		saving: boolean;
		treatments: SupplierTreatment[];
		rangeWarnings?: Record<string, string[]>;
		onToggleEditor: (item: EditableItem) => void;
		onRemove: (item: EditableItem) => void;
		onAdd: (kind: AddItemKind) => void;
		onApplyLens: (saved: EditableItem, treatments: EditLensTreatment[], brandName?: string) => void;
		onCommitProduct: (item: EditableItem) => void;
		onCommitFree: (item: EditableItem) => void;
	}

	let {
		activeItems,
		mainItems,
		editingId,
		editorKind,
		creating,
		saving,
		treatments,
		rangeWarnings = {},
		onToggleEditor,
		onRemove,
		onAdd,
		onApplyLens,
		onCommitProduct,
		onCommitFree
	}: Props = $props();

	let menuOpen = $state(false);
	let root = $state<HTMLElement>();

	function toneFor(item: EditableItem): DocumentItemTone {
		if (item.itemType === SaleItemType.LENS_PAIR) return 'crystal';
		if (item.itemType === SaleItemType.FREE_ITEM) return 'free';
		return 'product';
	}

	function typeLabelFor(item: EditableItem): string {
		if (item.itemType === SaleItemType.LENS_PAIR) return 'CRISTAL';
		if (item.itemType === SaleItemType.FREE_ITEM) return 'ÍTEM LIBRE';
		return 'PRODUCTO';
	}

	function treatmentsOf(item: EditableItem): EditableItem[] {
		if (!item.id) return [];
		return activeItems.filter(
			(child) => child.parentSaleItemId === item.id && child.itemType === SaleItemType.TREATMENT
		);
	}

	function hasRx(item: EditableItem): boolean {
		return [
			item.odSphere,
			item.odCylinder,
			item.odAxis,
			item.odAddition,
			item.osSphere,
			item.osCylinder,
			item.osAxis,
			item.osAddition
		].some((value) => value != null);
	}

	function subtitleFor(item: EditableItem): string | undefined {
		if (item.itemType === SaleItemType.LENS_PAIR) {
			const parts = [
				hasRx(item)
					? formatRxSummary({
							od: {
								sphere: item.odSphere,
								cylinder: item.odCylinder,
								axis: item.odAxis,
								addition: item.odAddition
							},
							oi: {
								sphere: item.osSphere,
								cylinder: item.osCylinder,
								axis: item.osAxis,
								addition: item.osAddition
							}
						})
					: 'Sin receta'
			];
			const names = treatmentsOf(item)
				.map((treatment) => treatment.snapshotName)
				.filter((name): name is string => Boolean(name));
			if (names.length > 0) parts.push(names.join(', '));
			return parts.join(' · ');
		}
		if (item.itemType === SaleItemType.FREE_ITEM) {
			return item.notes || item.freeItemCategory || 'Servicio o fórmula';
		}
		return [item.snapshotSku, item.snapshotBrand].filter(Boolean).join(' · ') || undefined;
	}

	function badgesFor(item: EditableItem): DocumentItemBadge[] {
		const warnings = item.id ? rangeWarnings[item.id] : undefined;
		if (!warnings?.length) return [];
		return [{ label: 'Rango', tone: 'warning', tooltip: warnings.join(' · ') }];
	}

	function toView(item: EditableItem): DocumentItemView {
		const title = item.snapshotName
			? item.snapshotName
			: item.itemType === SaleItemType.LENS_PAIR
				? 'Nuevo cristal'
				: item.itemType === SaleItemType.FREE_ITEM
					? (item.freeItemDescription ?? 'Nuevo ítem libre')
					: 'Nuevo producto';

		return {
			id: item.id ?? '',
			title,
			typeLabel: typeLabelFor(item),
			subtitle: subtitleFor(item),
			tone: toneFor(item),
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			discount: item.discount ?? 0,
			discountType: item.discountType,
			badges: badgesFor(item),
			isNew: creating && editingId === item.id
		};
	}

	function selectKind(kind: AddItemKind) {
		menuOpen = false;
		onAdd(kind);
	}

	function onWindowPointerDown(event: PointerEvent) {
		if (menuOpen && root && !root.contains(event.target as Node)) menuOpen = false;
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') menuOpen = false;
	}

	$effect(() => {
		if (!editingId) return;
		void tick().then(() => {
			const row = document.querySelector(`[data-item-id="${editingId}"]`);
			row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
	});
</script>

<svelte:window onpointerdown={onWindowPointerDown} onkeydown={onWindowKeydown} />

<div class="sec-head flex items-center gap-2 px-5 pt-4 pb-2.5">
	<span
		class="text-[11px] font-extrabold tracking-[0.1em] text-slate-400 uppercase dark:text-slate-500"
	>
		Artículos
	</span>
	<span
		class="rounded-full bg-surface-container-high px-1.5 py-px text-[11px] font-bold text-slate-400 dark:bg-slate-700 dark:text-slate-400"
	>
		{mainItems.length}
	</span>
</div>

{#if mainItems.length === 0}
	<div class="px-5 py-9 text-center text-[13px] text-slate-400 dark:text-slate-500">
		Sin artículos todavía — agrega el primero
	</div>
{:else}
	<div>
		{#each mainItems as item (item.id)}
			{@const view = toView(item)}
			<div
				data-item-id={item.id}
				class="border-b border-outline-variant/60 dark:border-slate-700"
				class:shadow-[inset_3px_0_0_var(--color-brand-blue)]={editingId === item.id}
			>
				<DocumentItemRow
					item={view}
					open={editingId === item.id}
					disabled={saving}
					onToggle={() => onToggleEditor(item)}
					onEdit={() => onToggleEditor(item)}
					onRemove={() => onRemove(item)}
				/>
			</div>

			{#if editingId === item.id && editorKind}
				<div class="bg-surface-container-low px-5 py-3.5 pl-[72px] dark:bg-slate-900/40">
					{#if editorKind === 'lens'}
						<EditSaleLensEditor
							{item}
							mode={creating ? 'add' : 'edit'}
							editTreatments={mapTreatmentsForEdit(activeItems, item.id)}
							{treatments}
							onApply={onApplyLens}
						/>
					{:else if editorKind === 'product'}
						<EditSaleProductEditor
							{item}
							mode={creating ? 'add' : 'edit'}
							onCommit={onCommitProduct}
						/>
					{:else}
						<EditSaleFreeEditor {item} mode={creating ? 'add' : 'edit'} onCommit={onCommitFree} />
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/if}

<div class="relative mx-5 mt-3 mb-5" bind:this={root}>
	<button
		type="button"
		onclick={() => {
			if (!saving) menuOpen = !menuOpen;
		}}
		disabled={saving}
		aria-expanded={menuOpen}
		aria-haspopup="menu"
		class="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-outline-variant bg-transparent text-[13px] font-semibold text-slate-500 transition hover:border-brand-blue hover:bg-brand-blue/5 hover:text-brand-blue-dark disabled:opacity-50 dark:border-slate-600 dark:text-slate-400 dark:hover:border-brand-blue dark:hover:text-brand-blue-light"
	>
		<Plus class="h-[15px] w-[15px]" />
		Agregar artículo
	</button>

	{#if menuOpen}
		<div
			class="absolute inset-x-0 bottom-[calc(100%+6px)] z-20 rounded-xl border border-outline-variant/60 bg-white p-1.5 shadow-xl shadow-slate-900/15 dark:border-slate-600 dark:bg-slate-800"
			role="menu"
		>
			{#each ADD_ITEM_KINDS as option (option.kind)}
				{@const Icon = option.icon}
				<button
					type="button"
					role="menuitem"
					onclick={() => selectKind(option.kind)}
					class="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition hover:bg-surface-container dark:hover:bg-slate-700"
				>
					<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {option.tone}">
						<Icon class="h-4 w-4" />
					</span>
					<span class="min-w-0">
						<span class="block text-[13px] font-semibold text-brand-navy dark:text-white">
							{option.label}
						</span>
						<span class="block text-[11.5px] text-slate-500 dark:text-slate-400">
							{option.hint}
						</span>
					</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
