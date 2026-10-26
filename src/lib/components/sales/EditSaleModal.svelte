<script lang="ts">
	import { SlideOver, ConfirmModal } from '$lib/components/ui';
	import { Package } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateSale } from '$lib/remote/sales/update.remote';
	import { getErrorMessage, logger } from '$lib/utils';
	import { DiscountType } from '$lib/shared/enums';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales/types';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { untrack } from 'svelte';
	import { fromISO } from '$lib/dates';
	import ItemSelect from './ItemSelect.svelte';
	import { getCachedLensItem, getCachedLensItems } from './catalogCache.svelte';
	import LensEditorPanel from '$lib/components/documentEditor/LensEditorPanel.svelte';
	import { createEmptyLensEditorDraft } from '$lib/components/documentEditor/lensEditor';
	import { SALE_CAPABILITIES, type LensEditorDraft } from '$lib/components/documentEditor/types';
	import EditSaleHeaderFields from './editSale/EditSaleHeaderFields.svelte';
	import EditSaleAddMenu from './editSale/EditSaleAddMenu.svelte';
	import type { AddItemKind } from './editSale/addItemKinds';
	import EditSaleAddFreeItemSection from './editSale/EditSaleAddFreeItemSection.svelte';
	import EditSaleAddProductSection from './editSale/EditSaleAddProductSection.svelte';
	import EditSaleItemsSection from './editSale/EditSaleItemsSection.svelte';
	import EditSaleSummarySection from './editSale/EditSaleSummarySection.svelte';
	import EditSaleFooter from './editSale/EditSaleFooter.svelte';
	import EditSaleModalHeader from './editSale/EditSaleModalHeader.svelte';
	import {
		applyLensEdit,
		buildLensInputFromDraft,
		buildUpdateSalePayload,
		createEmptyLensDraft,
		existingItemToInput,
		getLensEditContext,
		hasChangesForSale,
		mapTreatmentsForEdit,
		previewSubtotalForItems,
		seedCatalogCacheForItems,
		type EditableItem
	} from './editSaleDraft';
	import {
		collectLensRangeWarnings,
		editableItemFromLensEditorDraft,
		editTreatmentsFromLensEditor,
		filterCompatibleTreatments,
		lensEditorDraftFromEditableItem
	} from './editSale/editSaleLensAdapter';
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

	// ── Header fields ──────────────────────────────────────────────────────
	let saleDate = $state('');
	let notes = $state('');
	let isCashea = $state(false);
	let discount = $state(0);
	let discountType = $state<string>(DiscountType.FIXED);

	// ── Reason (mandatory) ──────────────────────────────────────────────────
	let reason = $state('');
	let reasonError = $state('');

	// ── Editable items ─────────────────────────────────────────────────────
	let editableItems = $state<EditableItem[]>([]);

	// ── Lens editing state ─────────────────────────────────────────────────
	let editingLensId = $state<string | null>(null); // null = adding new
	let lensBase = $state<EditableItem>(createEmptyLensDraft());
	let lensDraft = $state<LensEditorDraft>(createEmptyLensEditorDraft());

	// ── Add forms visibility ───────────────────────────────────────────────
	let showAddProduct = $state(false);
	let showAddFreeItem = $state(false);
	let showAddLens = $state(false);

	// ── Derived (via helpers) ────────────────────────────────────────────
	let hasChanges = $derived(
		hasChangesForSale(sale, saleDate, notes, discount, discountType, editableItems, items)
	);

	let activeItems = $derived(editableItems.filter((i) => !i._removed));
	let mainItems = $derived(activeItems.filter((i) => i.itemType !== SaleItemType.TREATMENT));
	let removedCount = $derived(editableItems.filter((i) => i._removed).length);
	let previewTotals = $derived(previewSubtotalForItems(activeItems, discount, discountType));
	let previewSubtotal = $derived(previewTotals.subtotal);
	let previewGlobalDiscount = $derived(previewTotals.globalDiscount);
	let previewTotal = $derived(previewTotals.total);
	let lensEditing = $derived(showAddLens || editingLensId !== null);

	let activeAddKind = $derived<AddItemKind | null>(
		showAddLens ? 'lens' : showAddProduct ? 'product' : showAddFreeItem ? 'free' : null
	);

	let lensEditCtx = $derived(
		getLensEditContext(
			lensDraft.lensCatalogItemId,
			editTreatmentsFromLensEditor(lensDraft.treatments),
			treatments
		)
	);

	// Advertencias de rango de los cristales ya aplicados al borrador, para que
	// la excepción confirmada siga visible mientras se guarda la venta.
	let lensRangeWarnings = $derived(collectLensRangeWarnings(activeItems, getCachedLensItem));

	// ── Seed state (mount + each open) ─────────────────────────────────────
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
		showAddProduct = false;
		showAddFreeItem = false;
		cancelLensEdit();
		void seedCatalogCacheForItems(items).catch((error) => {
			logger.error('No se pudo cargar el catálogo de cristales de la venta', error);
		});
	}

	// Reseed local editable state each time the drawer opens (props may have
	// changed after a previous save). `untrack` keeps prop updates from
	// clobbering in-progress edits while the drawer stays open.
	$effect(() => {
		if (!open) return;
		untrack(() => seedFromProps());
	});

	// ── Scroll lock when open ──────────────────────────────────────────────
	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});

	// ── Lens editing ───────────────────────────────────────────────────────

	function startLensEdit(item: EditableItem) {
		editingLensId = item.id ?? null;
		lensBase = { ...item };
		const editTreatments = mapTreatmentsForEdit(activeItems, item.id);
		lensDraft = lensEditorDraftFromEditableItem(item, editTreatments);
		closeAllAddForms();
	}

	function startLensAdd() {
		editingLensId = null;
		lensBase = createEmptyLensDraft();
		lensDraft = createEmptyLensEditorDraft();
		showAddLens = true;
		closeAllAddFormsExcept('lens');
	}

	function cancelLensEdit() {
		editingLensId = null;
		lensBase = createEmptyLensDraft();
		lensDraft = createEmptyLensEditorDraft();
		showAddLens = false;
	}

	function handleLensSelect(id: string, unitPrice: number) {
		const lenses = getCachedLensItems();
		const previousSupplierId = lenses.find((lens) => lens.id === lensDraft.lensCatalogItemId)
			?.supplier?.id;
		const nextSupplierId = lenses.find((lens) => lens.id === id)?.supplier?.id;
		const supplierChanged = previousSupplierId !== nextSupplierId;

		lensDraft.lensCatalogItemId = id || '';
		if (id && unitPrice > 0) lensDraft.unitPrice = unitPrice;

		if (id && (supplierChanged || !editingLensId)) {
			if (lensDraft.treatments.length > 0) {
				toast.warning('Se quitaron los tratamientos porque pertenecen a otro proveedor');
			}
			lensDraft.treatments = [];
		}
	}

	function addTreatmentFromSelect(treatmentId: string) {
		if (!treatmentId) return;
		const treatment = lensEditCtx.availableTreatments.find((t) => t.id === treatmentId);
		if (!treatment) return;
		const salePrice = treatment.salePrice ?? treatment.price;
		lensDraft.treatments = [
			...lensDraft.treatments,
			{
				supplierTreatmentId: treatment.id,
				name: treatment.name,
				price: treatment.price,
				salePrice,
				isTaxable: treatment.isTaxable,
				category: treatment.category
			}
		];
	}

	function removeTreatmentFromEdit(idx: number) {
		lensDraft.treatments = lensDraft.treatments.filter((_, i) => i !== idx);
	}

	function applyLens() {
		if (!lensDraft.lensCatalogItemId) return;

		const wasEdit = editingLensId !== null;
		const lensItemId = editingLensId || crypto.randomUUID();
		const baseItem = editableItemFromLensEditorDraft(lensBase, lensDraft);
		baseItem.id = lensItemId;

		const selectedSupplierId = lensEditCtx.selectedLens?.supplier?.id;
		const compatibleTreatments = filterCompatibleTreatments(
			lensDraft.treatments,
			lensEditCtx.availableTreatments,
			!!selectedSupplierId
		);
		if (compatibleTreatments.length !== lensDraft.treatments.length) {
			toast.warning('Se omitieron tratamientos que no pertenecen al proveedor del cristal');
		}

		const savedItem = buildLensInputFromDraft(baseItem, lensEditCtx.selectedLens);

		editableItems = applyLensEdit(
			editableItems,
			editingLensId,
			savedItem,
			editTreatmentsFromLensEditor(compatibleTreatments),
			lensEditCtx.selectedLens?.supplier?.name ?? lensBase.snapshotBrand
		);
		cancelLensEdit();
		toast.success(wasEdit ? 'Cristal actualizado' : 'Cristal agregado');
	}

	// ── Remove item ────────────────────────────────────────────────────────
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
	}

	// ── Add items ──────────────────────────────────────────────────────────
	function appendItem(item: EditableItem) {
		editableItems = [...editableItems, item];
	}

	function closeAllAddForms() {
		showAddProduct = false;
		showAddFreeItem = false;
		showAddLens = false;
	}

	function closeAllAddFormsExcept(keep: string) {
		if (keep !== 'product') showAddProduct = false;
		if (keep !== 'free') showAddFreeItem = false;
		if (keep !== 'lens') showAddLens = false;
	}

	function selectAddKind(kind: AddItemKind) {
		if (activeAddKind === kind) return;

		if (kind === 'lens') {
			if (lensEditing) return;
			startLensAdd();
			return;
		}

		cancelLensEdit();
		showAddProduct = kind === 'product';
		showAddFreeItem = kind === 'free';
	}

	function closeAddForm() {
		cancelLensEdit();
		showAddProduct = false;
		showAddFreeItem = false;
	}

	// ── Submit ─────────────────────────────────────────────────────────────
	function validate(): boolean {
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

	// ── Close guarding ─────────────────────────────────────────────────────
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
	widthClass="w-full lg:w-[min(94vw,1280px)] lg:min-w-[720px]"
>
	{#snippet header({ onclose })}
		<EditSaleModalHeader
			orderNumber={sale.orderNumber}
			{saving}
			inventoryNotice={SALE_CAPABILITIES.inventory}
			onClose={onclose}
		/>
	{/snippet}

	<div class="space-y-5">
		<EditSaleHeaderFields
			{sale}
			bind:saleDate
			bind:notes
			bind:isCashea
			bind:discount
			bind:discountType
		/>

		<!-- ── Card: Artículos ── -->
		<section
			class="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50"
		>
			<div class="mb-4 flex flex-wrap items-center gap-3">
				<Package class="h-4 w-4 shrink-0 text-brand-blue" />
				<h3 class="shrink-0 text-sm font-bold text-brand-navy dark:text-white">
					Artículos ({activeItems.length})
				</h3>
				<div class="ml-auto">
					<EditSaleAddMenu
						activeKind={activeAddKind}
						showClose={lensEditing || activeAddKind !== null}
						onSelect={selectAddKind}
						onClose={closeAddForm}
					/>
				</div>
			</div>

			{#key showAddProduct}
				<EditSaleAddProductSection bind:show={showAddProduct} onAdd={appendItem} />
			{/key}

			{#key showAddFreeItem}
				<EditSaleAddFreeItemSection bind:show={showAddFreeItem} onAdd={appendItem} />
			{/key}

			{#if lensEditing}
				{#snippet lensSelector()}
					<ItemSelect
						kind="lens"
						value={lensDraft.lensCatalogItemId}
						onselect={handleLensSelect}
						label="Cristal"
					/>
				{/snippet}

				<LensEditorPanel
					mode={editingLensId ? 'edit' : 'add'}
					bind:draft={lensDraft}
					lensType={lensEditCtx.selectedLens?.type ?? ''}
					ranges={lensEditCtx.selectedLens?.ranges ?? []}
					selectableTreatments={lensEditCtx.selectableTreatments}
					{lensSelector}
					onAddTreatment={addTreatmentFromSelect}
					onRemoveTreatment={removeTreatmentFromEdit}
					onApply={applyLens}
					onCancel={cancelLensEdit}
				/>
			{/if}

			<EditSaleItemsSection
				{activeItems}
				{mainItems}
				{editingLensId}
				{saving}
				rangeWarnings={lensRangeWarnings}
				onEditLens={startLensEdit}
				onRemoveItem={removeItem}
			/>
		</section>

		<EditSaleSummarySection
			{previewSubtotal}
			{previewGlobalDiscount}
			{previewTotal}
			{removedCount}
		/>

		<EditSaleFooter
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
	</div>
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
