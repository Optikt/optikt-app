<script lang="ts">
	import { SlideOver, ConfirmModal } from '$lib/components/ui';
	import { toast } from 'svelte-sonner';
	import { updateSale } from '$lib/remote/sales/update.remote';
	import { getErrorMessage, logger } from '$lib/utils';
	import { DiscountType } from '$lib/shared/enums';
	import { ALL_FREE_ITEM_CATEGORIES, SaleItemType } from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import type { SupplierTreatment, Prescription } from '$lib/server/db/schema';
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	import EditSaleItemView from './editSale/EditSaleItemView.svelte';
	import { fromISO } from '$lib/dates';
	import { getCachedLensItem } from './catalogCache.svelte';
	import { SALE_CAPABILITIES } from '$lib/components/documentEditor/types';
	import EditSaleMetaBar from './editSale/EditSaleMetaBar.svelte';
	import EditSaleItemsList from './editSale/EditSaleItemsList.svelte';
	import type { EditorKind } from './editSale/editSaleViews';
	import EditSaleFooter from './editSale/EditSaleFooter.svelte';
	import EditSaleModalHeader from './editSale/EditSaleModalHeader.svelte';
	import type { AddItemKind } from './editSale/addItemKinds';
	import {
		applyLensEdit,
		buildUpdateSalePayload,
		existingItemToInput,
		hasChangesForSale,
		previewSubtotalForItems,
		seedCatalogCacheForItems,
		type EditableItem,
		type EditLensTreatment
	} from './editSaleDraft';
	import { collectLensRangeWarnings } from './editSale/editSaleLensAdapter';
	import { validateEditSale } from './editSaleValidation';

	interface Props {
		open: boolean;
		sale: SaleWithRelations;
		items: SaleItemWithDetails[];
		treatments: SupplierTreatment[];
		/** Sale prescription row (DP / nasal measures source for lens pairs). */
		prescription?: Prescription | null;
		onSuccess?: () => void;
	}

	let {
		open = $bindable(),
		sale,
		items,
		treatments = [],
		prescription = null,
		onSuccess
	}: Props = $props();

	let saving = $state(false);
	let submitError = $state('');
	let confirmDiscard = $state(false);

	// Clear the reason error as soon as the user types again.

	// ── Prescription measures (per-eye DP/DNP) — patched to the server save ─
	function measuresFromSeed(): Measures {
		return {
			odDp: prescription?.dp ?? null,
			osDp: prescription?.dp ?? null,
			odDnp: prescription?.npRight ?? null,
			osDnp: prescription?.npLeft ?? null
		};
	}

	type Measures = {
		odDp: number | null;
		osDp: number | null;
		odDnp: number | null;
		osDnp: number | null;
	};

	let measures = $state<Measures>(measuresFromSeed());

	const measuresChanged = $derived.by(() => {
		const seed = {
			dp: prescription?.dp ?? null,
			npRight: prescription?.npRight ?? null,
			npLeft: prescription?.npLeft ?? null
		};
		return (
			measures.odDp !== seed.dp || measures.odDnp !== seed.npRight || measures.osDnp !== seed.npLeft
		);
	});

	// ── Meta bar ────────────────────────────────────────────────────────────
	let saleDate = $state('');
	let notes = $state('');
	let isCashea = $state(false);

	// ── Order-level discount ────────────────────────────────────────────────
	let discount = $state(0);
	let discountType = $state<string>(DiscountType.FIXED);

	// ── Reason (mandatory) ──────────────────────────────────────────────────
	let reason = $state('');
	let reasonError = $state('');

	$effect(() => {
		if (reason) reasonError = '';
	});

	// ── Editable items + item detail view ───────────────────────────────────
	let editableItems = $state<EditableItem[]>([]);
	let editingId = $state<string | null>(null);
	let editorKind = $state<EditorKind | null>(null);
	let creating = $state(false);
	/** Two views inside the body: the list and the open item editor. */
	let view = $state<'list' | 'editor'>('list');
	let staggerRows = $state(false);
	let staggerTimer: ReturnType<typeof setTimeout> | undefined;

	function backToList() {
		view = 'list';

		staggerRows = true;
		clearTimeout(staggerTimer);
		staggerTimer = setTimeout(() => (staggerRows = false), 420);
	}

	function inFly(node: HTMLElement) {
		return view === 'list'
			? fly(node, { x: -28, duration: 280, easing: cubicOut })
			: fly(node, { x: 28, duration: 280, easing: cubicOut });
	}

	// ── Derived ─────────────────────────────────────────────────────────────
	let hasChanges = $derived.by(() => {
		return (
			hasChangesForSale(
				sale,
				saleDate,
				notes,
				discount,
				discountType,
				isCashea,
				editableItems,
				items
			) || measuresChanged
		);
	});
	let activeItems = $derived(editableItems.filter((item) => !item._removed));
	let mainItems = $derived(activeItems.filter((item) => item.itemType !== SaleItemType.TREATMENT));
	let removedCount = $derived(editableItems.filter((item) => item._removed).length);
	let previewTotals = $derived(previewSubtotalForItems(activeItems, discount, discountType));
	let previewSubtotal = $derived(previewTotals.subtotal);
	let previewGlobalDiscount = $derived(previewTotals.globalDiscount);
	let previewTotal = $derived(previewTotals.total);
	let lensRangeWarnings = $derived(collectLensRangeWarnings(activeItems, getCachedLensItem));

	// ── Seed state (mount + each open) ──────────────────────────────────────
	function seedFromProps() {
		saleDate = fromISO(sale.saleDate).toISOString().slice(0, 10);
		notes = sale.notes ?? '';
		isCashea = sale.isCashea ?? false;
		discount = sale.discount;
		discountType = sale.discountType;
		reason = '';
		reasonError = '';
		submitError = '';
		confirmDiscard = false;
		editableItems = items.map(existingItemToInput);
		measures = measuresFromSeed();
		editingId = null;
		editorKind = null;
		creating = false;
		view = 'list';
		staggerRows = false;
		void seedCatalogCacheForItems(items).catch((error) => {
			logger.error('No se pudo cargar el catálogo de cristales de la venta', error);
		});
	}

	$effect(() => {
		if (!open) return;
		untrack(() => seedFromProps());
	});

	// ── Scroll lock when open ───────────────────────────────────────────────
	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});

	// ── Inline editor ───────────────────────────────────────────────────────
	function kindFor(item: EditableItem): EditorKind {
		if (item.itemType === SaleItemType.LENS_PAIR) return 'lens';
		if (item.itemType === SaleItemType.FREE_ITEM) return 'free';
		return 'product';
	}

	function createPlaceholder(kind: AddItemKind): EditableItem {
		const base = {
			id: crypto.randomUUID(),
			quantity: 1,
			unitPrice: 0,
			discount: 0,
			discountType: DiscountType.FIXED,
			_removed: false
		};
		if (kind === 'lens') return { ...base, itemType: SaleItemType.LENS_PAIR };
		if (kind === 'product') return { ...base, itemType: SaleItemType.PRODUCT };
		return {
			...base,
			itemType: SaleItemType.FREE_ITEM,
			freeItemCategory: ALL_FREE_ITEM_CATEGORIES[0]
		};
	}

	function closeEditor() {
		if (creating && editingId) {
			const id = editingId;
			editableItems = editableItems.filter(
				(item) => item.id !== id && item.parentSaleItemId !== id
			);
		}
		editingId = null;
		editorKind = null;
		creating = false;
		view = 'list';
		staggerRows = false;
	}

	function startAdd(kind: AddItemKind) {
		closeEditor();
		const placeholder = createPlaceholder(kind);
		editableItems = [...editableItems, placeholder];
		editingId = placeholder.id ?? null;
		editorKind = kind;
		creating = true;
		view = 'editor';
	}

	function toggleEditor(item: EditableItem, _focusTreatments = false) {
		if (editingId === item.id) {
			closeEditor();
			return;
		}
		closeEditor();
		if (!item.id) return;
		editingId = item.id;
		editorKind = kindFor(item);
		creating = false;
		view = 'editor';
	}

	function finishEditing() {
		editingId = null;
		editorKind = null;
		creating = false;
		view = 'list';
		staggerRows = false;
	}

	function handleApplyLens(
		savedItem: EditableItem,
		editTreatments: EditLensTreatment[],
		brandName: string | undefined,
		applyInfo?: {
			measures: {
				odDp: number | null;
				osDp: number | null;
				odDnp: number | null;
				osDnp: number | null;
			};
			eyesWithRx: number;
		}
	) {
		const wasNew = creating;
		if (applyInfo) measures = applyInfo.measures;
		editableItems = applyLensEdit(
			editableItems,
			editingId,
			savedItem,
			editTreatments,
			brandName,
			applyInfo?.eyesWithRx ?? 2
		);
		finishEditing();
		toast.success(wasNew ? 'Cristal agregado' : 'Cristal actualizado');
	}

	function replaceItem(updated: EditableItem) {
		editableItems = editableItems.map((item) => (item.id === updated.id ? updated : item));
	}

	function handleCommitProduct(updated: EditableItem) {
		const wasNew = creating;
		replaceItem(updated);
		finishEditing();
		toast.success(wasNew ? 'Producto agregado' : 'Producto actualizado');
	}

	function handleCommitFree(updated: EditableItem) {
		const wasNew = creating;
		replaceItem(updated);
		finishEditing();
		toast.success(wasNew ? 'Ítem libre agregado' : 'Ítem libre actualizado');
	}

	// ── Remove / restore item ─────────────────────────────────────────────────
	/** Placeholders (no server id) vanish outright; persisted items stay restorable. */
	function removeItem(item: EditableItem) {
		const targetId = item.id;
		if (!targetId) {
			editableItems = editableItems.filter(
				(existing) => existing !== item && existing.parentSaleItemId !== item.id
			);
			return;
		}
		item._removed = true;
		if (item.itemType === SaleItemType.LENS_PAIR) {
			for (const child of editableItems) {
				if (child.parentSaleItemId === targetId) {
					child._removed = true;
				}
			}
		}
		editableItems = [...editableItems];
		if (editingId === targetId) {
			creating = false;
			editingId = null;
			editorKind = null;
			backToList();
		}
	}

	function restoreItem(item: EditableItem) {
		const targetId = item.id;
		item._removed = false;
		for (const child of editableItems) {
			if (child.parentSaleItemId === targetId) {
				child._removed = false;
			}
		}
		editableItems = [...editableItems];
	}

	function removeChild(child: EditableItem) {
		child._removed = true;
		editableItems = [...editableItems];
	}

	// ── Submit ───────────────────────────────────────────────────────────────
	function validate(): boolean {
		if (editingId) {
			toast.error('Termina de editar el artículo abierto con «Hecho ✓».');
			return false;
		}
		const result = validateEditSale(reason, activeItems, {
			requireReason: SALE_CAPABILITIES.requiredReason
		});
		reasonError = result.reasonError;
		if (!result.valid && !reasonError) {
			toast.error('La venta debe tener al menos un artículo');
		}
		return result.valid;
	}

	async function handleSubmit() {
		submitError = '';
		if (!validate()) return;
		saving = true;

		const payload = buildUpdateSalePayload(sale, {
			saleDate,
			notes,
			isCashea,
			discount,
			discountType,
			reason,
			removedCount,
			activeItems,
			originalItems: items,
			prescription: {
				dp: prescription?.dp ?? null,
				npRight: prescription?.npRight ?? null,
				npLeft: prescription?.npLeft ?? null
			},
			prescriptionPatch: {
				dp: measures.odDp,
				npRight: measures.odDnp,
				npLeft: measures.osDnp
			}
		});

		try {
			const result = await updateSale(payload);
			if (result.success) {
				toast.success('Venta actualizada');
				confirmDiscard = false;
				open = false;
				onSuccess?.();
			} else {
				submitError = result.error ?? 'Error actualizando venta';
				toast.error(submitError);
			}
		} catch (e) {
			submitError = getErrorMessage(e, 'Error actualizando venta');
			toast.error(submitError);
		} finally {
			saving = false;
		}
	}

	// ── Close guarding ───────────────────────────────────────────────────────
	function guardClose(): boolean {
		if (saving) return false;
		if (!hasChanges) return true;
		confirmDiscard = true;
		return false;
	}

	function discardAndClose() {
		confirmDiscard = false;
		open = false;
	}
</script>

<SlideOver
	bind:open
	size="xl"
	closeGuard={guardClose}
	escapeHandler={() => {
		if (view === 'editor') {
			closeEditor();
			return true;
		}
		return false;
	}}
	widthClass="w-full lg:w-[clamp(720px,60vw,920px)]"
	bodyClass="p-0 bg-surface-drawer"
>
	{#snippet header({ onclose })}
		<EditSaleModalHeader
			orderNumber={sale.orderNumber}
			customer={sale.customer}
			bind:isCashea
			{saving}
			onClose={onclose}
		/>
		{#if view === 'list'}
			<EditSaleMetaBar bind:saleDate bind:notes />
		{/if}
	{/snippet}

	{#key view}
		{#if view === 'list'}
			<div transition:inFly>
				<EditSaleItemsList
					{activeItems}
					{mainItems}
					{saving}
					stagger={staggerRows}
					rangeWarnings={lensRangeWarnings}
					onToggleEditor={toggleEditor}
					onRemove={removeItem}
					onRestore={restoreItem}
					onAdd={startAdd}
					onRemoveChild={removeChild}
				/>
			</div>
		{:else}
			{@const editing = editableItems.find((item) => item.id === editingId)}
			{#if editing}
				<EditSaleItemView
					item={editing}
					{activeItems}
					kind={editorKind ?? 'lens'}
					{creating}
					{treatments}
					onApplyLens={handleApplyLens}
					onCommitProduct={handleCommitProduct}
					onCommitFree={handleCommitFree}
					onBack={closeEditor}
				/>
			{/if}
		{/if}
	{/key}

	{#snippet footer()}
		<EditSaleFooter
			subtotal={previewSubtotal}
			orderDiscountAmount={previewGlobalDiscount}
			total={previewTotal}
			bind:discount
			bind:discountType
			bind:reason
			{reasonError}
			{submitError}
			{saving}
			{hasChanges}
			hasItems={activeItems.length > 0}
			onClose={() => {
				if (guardClose()) open = false;
			}}
			onSubmit={handleSubmit}
		/>
	{/snippet}
</SlideOver>

<ConfirmModal
	bind:open={confirmDiscard}
	title="Descartar cambios"
	message="Tienes cambios sin guardar en esta venta. Si cierras ahora se perderán."
	confirmLabel="Descartar y cerrar"
	cancelLabel="Seguir editando"
	confirmColor="red"
	onConfirm={discardAndClose}
	onCancel={() => (confirmDiscard = false)}
/>
