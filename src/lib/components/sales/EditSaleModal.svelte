<script lang="ts">
	import { SlideOver } from '$lib/components/ui';
	import { Package, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateSale } from '$lib/remote/sales.remote';
	import { getErrorMessage } from '$lib/utils';
	import { DiscountType } from '$lib/shared/enums';
	import { SaleItemType, FreeItemCategory } from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { untrack, onMount } from 'svelte';
	import { getCachedProducts } from './catalogCache.svelte';
	import { fromISO } from '$lib/dates';
	import EditSaleHeaderFields from './editSale/EditSaleHeaderFields.svelte';
	import EditSaleAddFreeItemPanel from './editSale/EditSaleAddFreeItemPanel.svelte';
	import EditSaleAddProductPanel from './editSale/EditSaleAddProductPanel.svelte';
	import EditSaleItemsSection from './editSale/EditSaleItemsSection.svelte';
	import EditSaleLensPanel from './editSale/EditSaleLensPanel.svelte';
	import EditSaleSummarySection from './editSale/EditSaleSummarySection.svelte';
	import EditSaleFooter from './editSale/EditSaleFooter.svelte';
	import EditSaleModalHeader from './editSale/EditSaleModalHeader.svelte';
	import {
		applyLensEdit,
		buildLensInputFromDraft,
		buildUpdateSalePayload,
		createEmptyLensDraft,
		createFreeItem,
		createProductItem,
		existingItemToInput,
		getLensEditContext,
		hasChangesForSale,
		mapTreatmentsForEdit,
		previewSubtotalForItems,
		seedCatalogCacheForItems,
		type EditableItem,
		type EditLensTreatment
	} from './editSaleDraft';
	import { validateEditSale } from './editSaleValidation';

	interface Props {
		open: boolean;
		sale: SaleWithRelations;
		items: SaleItemWithDetails[];
		treatments: SupplierTreatment[];
		onSuccess?: () => void;
	}

	let { open = $bindable(), sale, items, treatments = [], onSuccess }: Props = $props();

	// Seed the catalog cache with the lens items already in this sale so
	// treatment lists and lens type checks work without SSR-loading the catalog.
	onMount(() => {
		void seedCatalogCacheForItems(items);
	});

	let saving = $state(false);

	// ── Header fields ──────────────────────────────────────────────────────
	let saleDate = $state(untrack(() => fromISO(sale.saleDate).toISOString().slice(0, 10)));
	let notes = $state(untrack(() => sale.notes ?? ''));
	let isCashea = $state(untrack(() => sale.isCashea ?? false));
	let discount = $state(untrack(() => sale.discount));
	let discountType = $state<string>(untrack(() => sale.discountType));

	// ── Reason (mandatory) ──────────────────────────────────────────────────
	let reason = $state('');
	let reasonError = $state('');

	// ── Editable items ─────────────────────────────────────────────────────
	let editableItems = $state<EditableItem[]>(untrack(() => items.map(existingItemToInput)));

	// ── Lens editing state ─────────────────────────────────────────────────
	let editingLensId = $state<string | null>(null); // null = adding new
	let editLensTmp: EditableItem = $state(createEmptyLensDraft());
	let editLensTreatments: EditLensTreatment[] = $state([]);

	// ── Add forms visibility ───────────────────────────────────────────────
	let showAddProduct = $state(false);
	let showAddFreeItem = $state(false);
	let showAddLens = $state(false);

	// ── Add product form state ─────────────────────────────────────────────
	let addProductId = $state('');
	let addProductQty = $state(1);
	let addProductPrice = $state(0);
	let addProductDiscount = $state(0);
	let addProductDiscountType = $state<string>(DiscountType.FIXED);
	let addProductNotes = $state('');

	// ── Add free item form state ───────────────────────────────────────────
	let addFreeCategory = $state(FreeItemCategory.CONTACT_LENS_FORMULA);
	let addFreeDescription = $state('');
	let addFreePrice = $state(0);
	let addFreeDiscount = $state(0);
	let addFreeDiscountType = $state<string>(DiscountType.FIXED);
	let addFreeNotes = $state('');

	// ── Derived (via helpers) ────────────────────────────────────────────
	let hasChanges = $derived(
		hasChangesForSale(sale, saleDate, notes, discount, discountType, editableItems)
	);

	let activeItems = $derived(editableItems.filter((i) => !i._removed));
	let mainItems = $derived(activeItems.filter((i) => i.itemType !== SaleItemType.TREATMENT));
	let removedCount = $derived(editableItems.filter((i) => i._removed).length);
	let previewTotals = $derived(previewSubtotalForItems(activeItems, discount, discountType));
	let previewSubtotal = $derived(previewTotals.subtotal);
	let previewGlobalDiscount = $derived(previewTotals.globalDiscount);
	let previewTotal = $derived(previewTotals.total);

	let lensEditCtx = $derived(
		getLensEditContext(editLensTmp.lensCatalogItemId, editLensTreatments, treatments)
	);

	// ── Scroll lock when open ──────────────────────────────────────────────
	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});

	// Helpers moved to ./editSaleDraft.ts — imported above

	// ── Lens editing ───────────────────────────────────────────────────────

	function startLensEdit(item: EditableItem) {
		editingLensId = item.id ?? null;
		editLensTmp = { ...item };
		editLensTreatments = mapTreatmentsForEdit(activeItems, item.id);
		closeAllAddForms();
	}

	function startLensAdd() {
		editingLensId = null;
		editLensTmp = createEmptyLensDraft();
		editLensTreatments = [];
		showAddLens = true;
		closeAllAddFormsExcept('lens');
	}

	function cancelLensEdit() {
		editingLensId = null;
		editLensTmp = createEmptyLensDraft();
		editLensTreatments = [];
		showAddLens = false;
	}

	function handleLensSelect(id: string, unitPrice: number) {
		editLensTmp.lensCatalogItemId = id || undefined;
		if (id && unitPrice > 0) editLensTmp.unitPrice = unitPrice;
		if (id && !editingLensId) {
			editLensTreatments = [];
		}
	}

	function addTreatmentFromSelect(treatmentId: string) {
		if (!treatmentId) return;
		const treatment = lensEditCtx.availableTreatments.find((t) => t.id === treatmentId);
		if (!treatment) return;
		const salePrice = treatment.salePrice ?? treatment.price;
		editLensTreatments = [
			...editLensTreatments,
			{
				supplierTreatmentId: treatment.id,
				name: treatment.name,
				price: treatment.price,
				salePrice,
				isTaxable: treatment.isTaxable,
				category: treatment.category,
				_keep: true
			}
		];
	}

	function removeTreatmentFromEdit(idx: number) {
		editLensTreatments = editLensTreatments.filter((_, i) => i !== idx);
	}

	function saveLensEdit() {
		if (!editLensTmp.lensCatalogItemId) {
			toast.error('Seleccione un cristal');
			return;
		}
		if (editLensTmp.unitPrice <= 0) {
			toast.error('El precio debe ser mayor a 0');
			return;
		}

		const lensItemId = editingLensId || crypto.randomUUID();
		const savedItem = buildLensInputFromDraft(editLensTmp, lensEditCtx.selectedLens);
		savedItem.id = lensItemId;

		editableItems = applyLensEdit(
			editableItems,
			editingLensId,
			savedItem,
			editLensTreatments,
			lensEditCtx.selectedLens?.supplier?.name ?? editLensTmp.snapshotBrand
		);
		cancelLensEdit();
		toast.success(editingLensId ? 'Cristal actualizado' : 'Cristal agregado');
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

	// ── Add product ────────────────────────────────────────────────────────
	function handleProductSelect(id: string, unitPrice: number) {
		addProductId = id;
		if (unitPrice > 0) addProductPrice = unitPrice;
	}

	function addNewProduct() {
		if (!addProductId) {
			toast.error('Seleccione un producto');
			return;
		}
		const product = getCachedProducts().find((p) => p.id === addProductId);
		if (!product) {
			toast.error('Producto no encontrado');
			return;
		}

		editableItems = [
			...editableItems,
			createProductItem(product, {
				productId: addProductId,
				quantity: addProductQty,
				unitPrice: addProductPrice,
				discount: addProductDiscount,
				discountType: addProductDiscountType,
				notes: addProductNotes
			})
		];
		resetAddProductForm();
		toast.success('Producto agregado');
	}

	function resetAddProductForm() {
		showAddProduct = false;
		addProductId = '';
		addProductQty = 1;
		addProductPrice = 0;
		addProductDiscount = 0;
		addProductDiscountType = DiscountType.FIXED;
		addProductNotes = '';
	}

	// ── Add free item ──────────────────────────────────────────────────────
	function addNewFreeItem() {
		if (!addFreeDescription?.trim() || addFreeDescription.trim().length < 3) {
			toast.error('La descripción debe tener al menos 3 caracteres');
			return;
		}
		if (addFreePrice <= 0) {
			toast.error('El precio de venta debe ser mayor a 0');
			return;
		}

		editableItems = [
			...editableItems,
			createFreeItem({
				category: addFreeCategory as FreeItemCategory,
				description: addFreeDescription,
				price: addFreePrice,
				discount: addFreeDiscount,
				discountType: addFreeDiscountType,
				notes: addFreeNotes
			})
		];
		resetAddFreeItemForm();
		toast.success('Ítem libre agregado');
	}

	function resetAddFreeItemForm() {
		showAddFreeItem = false;
		addFreeCategory = FreeItemCategory.CONTACT_LENS_FORMULA;
		addFreeDescription = '';
		addFreePrice = 0;
		addFreeDiscount = 0;
		addFreeDiscountType = DiscountType.FIXED;
		addFreeNotes = '';
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

	// ── Submit ─────────────────────────────────────────────────────────────
	function validate(): boolean {
		const result = validateEditSale(reason, activeItems);
		reasonError = result.reasonError;
		if (!result.valid && !reasonError) {
			toast.error('La venta debe tener al menos un artículo');
		}
		return result.valid;
	}

	async function handleSubmit() {
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
			activeItems
		});

		try {
			const result = await updateSale(payload);
			if (result.success) {
				toast.success('Venta actualizada');
				handleClose();
				onSuccess?.();
			} else {
				toast.error(result.error ?? 'Error actualizando venta');
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error actualizando venta'));
		} finally {
			saving = false;
		}
	}

	function handleClose() {
		if (saving) return;
		open = false;
	}
</script>

<SlideOver bind:open size="xl" onclose={handleClose}>
	{#snippet header()}
		<EditSaleModalHeader
			orderNumber={sale.orderNumber}
			{saving}
			onClose={handleClose}
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
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Package class="h-4 w-4 text-brand-blue" />
					<h3 class="text-sm font-bold text-brand-navy dark:text-white">
						Artículos ({activeItems.length})
					</h3>
				</div>
				<div class="flex gap-1.5">
					<button
						type="button"
						onclick={() => {
							closeAllAddFormsExcept('lens');
							startLensAdd();
						}}
						class="inline-flex items-center gap-1 rounded-lg bg-cyan-100 px-2.5 py-1.5 text-[11px] font-bold text-cyan-800 transition-colors hover:bg-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-900"
					>
						<Plus class="h-3 w-3" /> Cristal
					</button>
					<button
						type="button"
						onclick={() => {
							closeAllAddFormsExcept('product');
							showAddProduct = !showAddProduct;
						}}
						class="inline-flex items-center gap-1 rounded-lg bg-brand-navy/10 px-2.5 py-1.5 text-[11px] font-bold text-brand-navy transition-colors hover:bg-brand-navy/20 dark:bg-brand-navy/30 dark:text-white dark:hover:bg-brand-navy/50"
					>
						<Plus class="h-3 w-3" /> Producto
					</button>
					<button
						type="button"
						onclick={() => {
							closeAllAddFormsExcept('free');
							showAddFreeItem = !showAddFreeItem;
						}}
						class="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900"
					>
						<Plus class="h-3 w-3" /> Ítem libre
					</button>
				</div>
			</div>

			<EditSaleAddProductPanel
				bind:showAddProduct
				bind:addProductId
				bind:addProductQty
				bind:addProductPrice
				bind:addProductDiscount
				bind:addProductDiscountType
				bind:addProductNotes
				onSelectProduct={handleProductSelect}
				onAddProduct={addNewProduct}
				onCancel={resetAddProductForm}
			/>

			<EditSaleAddFreeItemPanel
				{showAddFreeItem}
				bind:addFreeCategory
				bind:addFreeDescription
				bind:addFreePrice
				bind:addFreeDiscount
				bind:addFreeDiscountType
				bind:addFreeNotes
				onAddFreeItem={addNewFreeItem}
				onCancel={resetAddFreeItemForm}
			/>

			<EditSaleLensPanel
				{showAddLens}
				{editingLensId}
				bind:editLensTmp
				bind:editLensTreatments
				selectableTreatments={lensEditCtx.selectableTreatments}
				showAddition={lensEditCtx.showAddition}
				onLensSelect={handleLensSelect}
				onAddTreatment={addTreatmentFromSelect}
				onRemoveTreatment={removeTreatmentFromEdit}
				onSave={saveLensEdit}
				onCancel={cancelLensEdit}
			/>

			<EditSaleItemsSection
				{activeItems}
				{mainItems}
				{editingLensId}
				{saving}
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
			{removedCount}
			{saving}
			{hasChanges}
			onClose={handleClose}
			onSubmit={handleSubmit}
			onClearReasonError={() => (reasonError = '')}
		/>
	</div>
</SlideOver>
