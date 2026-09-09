<script lang="ts">
	import { SlideOver } from '$lib/components/ui';
	import { Package, Plus, X, Pen, Calculator } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateSale } from '$lib/remote/sales.remote';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { DiscountType } from '$lib/shared/enums';
	import { SaleItemType, FreeItemCategory, LensType } from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales';
	import type { UpdateSaleInput } from '$lib/schemas/sales';
	import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { untrack, onMount } from 'svelte';
	import { getCatalogItemsByIds } from '$lib/remote/catalog.remote';
	import { cacheCatalogItems, getCachedProducts, getCachedLensItems } from './catalogCache.svelte';
	import { fromISO, fromISODate, nowUTC, toUTCString } from '$lib/dates';
	import EditSaleHeaderFields from './editSale/EditSaleHeaderFields.svelte';
	import EditSaleAddFreeItemPanel from './editSale/EditSaleAddFreeItemPanel.svelte';
	import EditSaleAddProductPanel from './editSale/EditSaleAddProductPanel.svelte';
	import EditSaleItemsSection from './editSale/EditSaleItemsSection.svelte';
	import EditSaleLensPanel from './editSale/EditSaleLensPanel.svelte';
	import {
		buildLensInputFromDraft,
		createEmptyLensDraft,
		existingItemToInput,
		hasChangesForSale,
		previewSubtotalForItems,
		type EditableItem
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
		const lensIds = items.map((i) => i.lensCatalogItemId).filter((id): id is string => Boolean(id));
		if (lensIds.length === 0) return;
		void getCatalogItemsByIds({ lensIds }).then((results) =>
			cacheCatalogItems([], results.lensItems)
		);
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
	let editLensTreatments: {
		supplierTreatmentId: string;
		name: string;
		price: number;
		salePrice: number;
		isTaxable: boolean;
		category: string;
		_keep?: boolean;
	}[] = $state([]);

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

	let availableTreatments = $derived.by(() => {
		if (!editLensTmp.lensCatalogItemId) return [];
		const lens = getCachedLensItems().find((l) => l.id === editLensTmp.lensCatalogItemId);
		const supplierId = lens?.supplier?.id;
		if (!supplierId) return [];
		return treatments.filter((t) => t.supplierId === supplierId);
	});

	let selectableTreatments = $derived(
		availableTreatments.filter(
			(t) => !editLensTreatments.some((et) => et.supplierTreatmentId === t.id)
		)
	);

	let selectedLens = $derived(
		editLensTmp.lensCatalogItemId
			? (getCachedLensItems().find((l) => l.id === editLensTmp.lensCatalogItemId) ?? null)
			: null
	);

	let showAddition = $derived(selectedLens?.type !== LensType.MONOFOCAL);

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
		editLensTreatments = activeItems
			.filter((i) => i.parentSaleItemId === item.id && i.itemType === SaleItemType.TREATMENT)
			.map((t) => ({
				supplierTreatmentId: t.supplierTreatmentId ?? '',
				name: t.snapshotName ?? 'Tratamiento',
				price: (t.snapshotBaseCost ?? t.unitPrice) / 2,
				salePrice: t.unitPrice / 2,
				isTaxable: t.snapshotIsTaxable ?? true,
				category: t.snapshotTreatmentCategory ?? '',
				_keep: true
			}));
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
		const treatment = availableTreatments.find((t) => t.id === treatmentId);
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
		const savedItem = buildLensInputFromDraft(editLensTmp, selectedLens);
		savedItem.id = lensItemId;

		let updated = editableItems.filter((i) => {
			if (i._removed) return true;
			if (editingLensId && i.id === editingLensId) return false;
			if (editingLensId && i.parentSaleItemId === editingLensId) return false;
			return true;
		});

		updated = [...updated, savedItem];

		for (const t of editLensTreatments) {
			const treatmentRow: EditableItem = {
				itemType: SaleItemType.TREATMENT,
				parentSaleItemId: lensItemId,
				supplierTreatmentId: t.supplierTreatmentId,
				quantity: 1,
				unitPrice: t.salePrice * 2,
				discount: 0,
				discountType: DiscountType.FIXED,
				snapshotName: t.name,
				snapshotBrand: selectedLens?.supplier?.name ?? editLensTmp.snapshotBrand,
				snapshotTreatmentCategory: t.category,
				snapshotIsTaxable: t.isTaxable,
				snapshotBaseCost: t.price * 2,
				_removed: false
			};
			updated = [...updated, treatmentRow];
		}

		editableItems = updated;
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
			{
				itemType: SaleItemType.PRODUCT,
				productId: addProductId,
				quantity: addProductQty,
				unitPrice: addProductPrice,
				discount: addProductDiscount,
				discountType: addProductDiscountType as DiscountTypeEnum,
				snapshotName: product.name,
				snapshotSku: product.sku ?? undefined,
				snapshotBrand: product.brand?.name ?? undefined,
				snapshotIsTaxable: product.isTaxable ?? true,
				notes: addProductNotes || undefined,
				_removed: false
			}
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
			{
				itemType: SaleItemType.FREE_ITEM,
				quantity: 1,
				unitPrice: addFreePrice,
				discount: addFreeDiscount,
				discountType: addFreeDiscountType as DiscountTypeEnum,
				freeItemCategory: addFreeCategory as FreeItemCategory,
				freeItemDescription: addFreeDescription.trim(),
				snapshotName: addFreeDescription.trim(),
				notes: addFreeNotes || undefined,
				_removed: false
			}
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

		const payload: UpdateSaleInput = { id: sale.id, reason: reason.trim() };

		if (saleDate !== sale.saleDate.slice(0, 10)) {
			const old = fromISO(sale.saleDate);
			const nd = fromISODate(saleDate)!;
			const isDateOnly = !sale.saleDate.includes('T');
			const isMidnightUTC =
				old.getUTCHours() === 0 &&
				old.getUTCMinutes() === 0 &&
				old.getUTCSeconds() === 0 &&
				old.getUTCMilliseconds() === 0;
			const src = isDateOnly || isMidnightUTC ? nowUTC() : old;
			nd.setHours(src.getHours(), src.getMinutes(), src.getSeconds(), src.getMilliseconds());
			payload.saleDate = toUTCString(nd);
		}
		if (notes !== (sale.notes ?? '')) {
			payload.notes = notes || undefined;
		}
		if (isCashea !== (sale.isCashea ?? false)) payload.isCashea = isCashea;
		if (discount !== sale.discount) payload.discount = discount;
		if (discountType !== sale.discountType) payload.discountType = discountType as DiscountTypeEnum;

		if (
			removedCount > 0 ||
			activeItems.some((i) => !i.id) ||
			discount !== sale.discount ||
			discountType !== sale.discountType
		) {
			payload.items = activeItems.map(({ _removed, ...input }) => input);
		}

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
	{#snippet header({ onclose })}
		<header
			class="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700"
		>
			<div class="min-w-0 flex-1">
				<h2 class="truncate text-lg font-bold text-brand-navy dark:text-white">
					Modificar Orden #{String(sale.orderNumber).padStart(4, '0')}
				</h2>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
					Los cambios se registrarán en auditoría. Artículos nuevos consumirán inventario.
				</p>
			</div>
			<button
				type="button"
				onclick={onclose}
				disabled={saving}
				class="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 max-sm:h-10 max-sm:w-10 dark:hover:bg-slate-800 dark:hover:text-slate-300"
			>
				<X class="h-5 w-5" />
			</button>
		</header>
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
				{selectableTreatments}
				{showAddition}
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

		<!-- ── Card: Resumen ── -->
		<section
			class="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50"
		>
			<div class="mb-4 flex items-center gap-2">
				<Calculator class="h-4 w-4 text-brand-blue" />
				<h3 class="text-sm font-bold text-brand-navy dark:text-white">Resumen</h3>
			</div>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-slate-600 dark:text-slate-400">Subtotal</span>
					<span class="font-semibold text-slate-800 dark:text-white">
						{formatPrice(previewSubtotal)}
					</span>
				</div>
				{#if previewGlobalDiscount > 0}
					<div class="flex justify-between">
						<span class="text-slate-600 dark:text-slate-400">Descuento</span>
						<span class="font-semibold text-slate-800 dark:text-white">
							-{formatPrice(previewGlobalDiscount)}
						</span>
					</div>
				{/if}
				<div class="flex justify-between">
					<span class="font-bold text-slate-800 dark:text-white">Total</span>
					<span class="font-bold text-slate-800 dark:text-white">
						{formatPrice(previewTotal)}
					</span>
				</div>
				{#if removedCount > 0}
					<div class="flex justify-between text-red-600 dark:text-red-400">
						<span>Artículos eliminados</span>
						<span class="font-semibold">{removedCount}</span>
					</div>
				{/if}
			</div>
		</section>

		<!-- ═══ FOOTER — Fixed ═══ -->
		<footer
			class="shrink-0 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900"
		>
			<div class="space-y-3">
				<!-- Reason field -->
				<div>
					<label
						for="edit-reason"
						class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
					>
						Motivo de la modificación <span class="text-red-500">*</span>
					</label>
					<textarea
						id="edit-reason"
						bind:value={reason}
						oninput={() => (reasonError = '')}
						rows="2"
						placeholder="Explique por qué está modificando esta venta..."
						class="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light"
					></textarea>
					{#if reasonError}<p class="mt-1 text-xs text-red-600">{reasonError}</p>{/if}
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-between gap-3">
					<div class="text-xs text-slate-500 dark:text-slate-400">
						{#if removedCount > 0}
							<span class="text-red-600 dark:text-red-400"
								>{removedCount} artículo(s) eliminado(s)</span
							>
						{/if}
					</div>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={handleClose}
							disabled={saving}
							class="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
						>
							Cancelar
						</button>
						<button
							type="button"
							onclick={handleSubmit}
							disabled={saving || !hasChanges}
							class="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50"
						>
							{#if saving}
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
								></span>
								Guardando...
							{:else}
								<Pen class="h-4 w-4" /> Guardar cambios
							{/if}
						</button>
					</div>
				</div>
			</div>
		</footer>
	</div>
</SlideOver>
