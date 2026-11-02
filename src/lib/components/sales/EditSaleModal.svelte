<script lang="ts">
	import { SlideOver, ConfirmModal } from '$lib/components/ui';
	import { toast } from 'svelte-sonner';
	import { updateSale } from '$lib/remote/sales/update.remote';
	import { getErrorMessage, logger } from '$lib/utils';
	import { DiscountType } from '$lib/shared/enums';
	import { ALL_FREE_ITEM_CATEGORIES, SaleItemType } from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { untrack } from 'svelte';
	import { fromISO } from '$lib/dates';
	import { getCachedLensItem } from './catalogCache.svelte';
	import { SALE_CAPABILITIES } from '$lib/components/documentEditor/types';
	import EditSaleMetaBar from './editSale/EditSaleMetaBar.svelte';
	import EditSaleItemsList, { type EditorKind } from './editSale/EditSaleItemsList.svelte';
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
		onSuccess?: () => void;
	}

	let { open = $bindable(), sale, items, treatments = [], onSuccess }: Props = $props();

	let saving = $state(false);
	let submitError = $state('');
	let confirmDiscard = $state(false);

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

	// ── Editable items + inline editor ──────────────────────────────────────
	let editableItems = $state<EditableItem[]>([]);
	let editingId = $state<string | null>(null);
	let editorKind = $state<EditorKind | null>(null);
	let creating = $state(false);

	// ── Derived ─────────────────────────────────────────────────────────────
	let hasChanges = $derived(
		hasChangesForSale(sale, saleDate, notes, discount, discountType, editableItems, items)
	);
	let activeItems = $derived(editableItems.filter((item) => !item._removed));
	let mainItems = $derived(activeItems.filter((item) => item.itemType !== SaleItemType.TREATMENT));
	let removedCount = $derived(editableItems.filter((item) => item._removed).length);
	let previewTotals = $derived(previewSubtotalForItems(activeItems, discount, discountType));
	let previewSubtotal = $derived(previewTotals.subtotal);
	let previewGlobalDiscount = $derived(previewTotals.globalDiscount);
	let previewTotal = $derived(previewTotals.total);
	let itemsDiscount = $derived(
		Math.max(
			0,
			activeItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) - previewSubtotal
		)
	);
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
		editingId = null;
		editorKind = null;
		creating = false;
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
	}

	function startAdd(kind: AddItemKind) {
		closeEditor();
		const placeholder = createPlaceholder(kind);
		editableItems = [...editableItems, placeholder];
		editingId = placeholder.id ?? null;
		editorKind = kind;
		creating = true;
	}

	function toggleEditor(item: EditableItem) {
		if (editingId === item.id) {
			closeEditor();
			return;
		}
		closeEditor();
		if (!item.id) return;
		editingId = item.id;
		editorKind = kindFor(item);
		creating = false;
	}

	function finishEditing() {
		editingId = null;
		editorKind = null;
		creating = false;
	}

	function handleApplyLens(
		savedItem: EditableItem,
		editTreatments: EditLensTreatment[],
		brandName: string | undefined
	) {
		const wasNew = creating;
		editableItems = applyLensEdit(editableItems, editingId, savedItem, editTreatments, brandName);
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

	// ── Remove item ──────────────────────────────────────────────────────────
	function removeItem(item: EditableItem) {
		const targetId = item.id;
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
		}
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
			originalItems: items
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
	widthClass="w-full lg:w-[680px]"
	bodyClass="p-0"
>
	{#snippet header({ onclose })}
		<EditSaleModalHeader
			orderNumber={sale.orderNumber}
			{saving}
			inventoryNotice={SALE_CAPABILITIES.inventory}
			onClose={onclose}
		/>
		<EditSaleMetaBar {sale} bind:saleDate bind:notes bind:isCashea />
	{/snippet}

	<EditSaleItemsList
		{activeItems}
		{mainItems}
		{editingId}
		{editorKind}
		{creating}
		{saving}
		{treatments}
		rangeWarnings={lensRangeWarnings}
		onToggleEditor={toggleEditor}
		onRemove={removeItem}
		onAdd={startAdd}
		onApplyLens={handleApplyLens}
		onCommitProduct={handleCommitProduct}
		onCommitFree={handleCommitFree}
	/>

	{#snippet footer()}
		<EditSaleFooter
			subtotal={previewSubtotal}
			{itemsDiscount}
			orderDiscountAmount={previewGlobalDiscount}
			total={previewTotal}
			bind:discount
			bind:discountType
			bind:reason
			{reasonError}
			{submitError}
			{removedCount}
			{saving}
			{hasChanges}
			onClose={() => {
				if (guardClose()) open = false;
			}}
			onSubmit={handleSubmit}
			onClearReasonError={() => (reasonError = '')}
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
