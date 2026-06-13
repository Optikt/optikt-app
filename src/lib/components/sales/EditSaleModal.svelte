<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { slide } from 'svelte/transition';
	import { Package, Eye, Sparkles, FlaskConical, Plus, X, Pen, Pencil, Save, Calculator, User, Tag, CalendarDays } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { updateSale } from '$lib/remote/sales.remote';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { DiscountType } from '$lib/shared/enums';
	import { SaleItemType, FreeItemCategory, LensType } from '$lib/shared/enums/lensTypes';
	import { ALL_FREE_ITEM_CATEGORIES } from '$lib/shared/enums/lensTypes';
	import type { SaleItemWithDetails, SaleWithRelations } from '$lib/server/db/queries/sales';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { SaleItemInput, UpdateSaleInput } from '$lib/schemas/sales';
	import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import ItemSelect from './ItemSelect.svelte';


	interface Props {
		open: boolean;
		sale: SaleWithRelations;
		items: SaleItemWithDetails[];
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		treatments: SupplierTreatment[];
		onSuccess?: () => void;
	}

	let {
		open = $bindable(),
		sale,
		items,
		products,
		lensItems = [],
		treatments = [],
		onSuccess
	}: Props = $props();

	let saving = $state(false);

	// ── Header fields ──────────────────────────────────────────────────────
	let saleDate = $state(sale.saleDate.slice(0, 10));
	let notes = $state(sale.notes ?? '');
	let discount = $state(sale.discount);
	let discountType = $state<string>(sale.discountType);

	// ── Reason (mandatory) ──────────────────────────────────────────────────
	let reason = $state('');
	let reasonError = $state('');

	// ── Editable items ─────────────────────────────────────────────────────
	type EditableItem = SaleItemInput & { _removed?: boolean };
	let editableItems = $state<EditableItem[]>(items.map(existingItemToInput));

	// ── Lens editing state ─────────────────────────────────────────────────
	let editingLensId = $state<string | null>(null); // null = adding new
	let editLensTmp: EditableItem = $state(createEmptyLensDraft());
	let editLensTreatments: { supplierTreatmentId: string; name: string; price: number; salePrice: number; isTaxable: boolean; category: string; _keep?: boolean }[] = $state([]);

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

	// ── Derived ────────────────────────────────────────────────────────────
	let hasChanges = $derived(
		saleDate !== sale.saleDate.slice(0, 10) ||
		notes !== (sale.notes ?? '') ||
		discount !== sale.discount ||
		discountType !== sale.discountType ||
		editableItems.some((i) => i._removed) ||
		editableItems.some((i) => !i.id)
	);

	let activeItems = $derived(editableItems.filter((i) => !i._removed));
	let mainItems = $derived(activeItems.filter((i) => i.itemType !== SaleItemType.TREATMENT));
	let removedCount = $derived(editableItems.filter((i) => i._removed).length);

	let availableTreatments = $derived.by(() => {
		if (!editLensTmp.lensCatalogItemId) return [];
		const lens = lensItems.find((l) => l.id === editLensTmp.lensCatalogItemId);
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
			? lensItems.find((l) => l.id === editLensTmp.lensCatalogItemId) ?? null
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

	// ── Helpers ────────────────────────────────────────────────────────────

	function createEmptyLensDraft(): EditableItem {
		return {
			itemType: SaleItemType.LENS_PAIR,
			quantity: 1,
			unitPrice: 0,
			discount: 0,
			discountType: DiscountType.FIXED,
			_removed: false
		};
	}

	function existingItemToInput(item: SaleItemWithDetails): EditableItem {
		return {
			id: item.id,
			itemType: item.itemType,
			productId: item.productId ?? undefined,
			lensCatalogItemId: item.lensCatalogItemId ?? undefined,
			parentSaleItemId: item.parentSaleItemId ?? undefined,
			supplierTreatmentId: item.supplierTreatmentId ?? undefined,
			prescriptionId: item.prescriptionId ?? undefined,
			odSphere: item.odSphere ?? undefined,
			odCylinder: item.odCylinder ?? undefined,
			odAxis: item.odAxis ?? undefined,
			odAddition: item.odAddition ?? undefined,
			osSphere: item.osSphere ?? undefined,
			osCylinder: item.osCylinder ?? undefined,
			osAxis: item.osAxis ?? undefined,
			osAddition: item.osAddition ?? undefined,
			quantity: item.quantity,
			unitPrice: item.unitPrice,
			discount: item.discount,
			discountType: item.discountType as DiscountType,
			snapshotName: item.snapshotName ?? undefined,
			snapshotSku: item.snapshotSku ?? undefined,
			snapshotBrand: item.snapshotBrand ?? undefined,
			snapshotBaseCost: item.snapshotBaseCost ?? undefined,
			snapshotMountingPrice: item.snapshotMountingPrice ?? undefined,
			snapshotShippingPrice: item.snapshotShippingPrice ?? undefined,
			snapshotSalePrice: item.snapshotSalePrice ?? undefined,
			snapshotPriceType: item.snapshotPriceType ?? undefined,
			snapshotTreatmentCategory: item.snapshotTreatmentCategory ?? undefined,
			snapshotIsTaxable: item.snapshotIsTaxable ?? undefined,
			shippingCostPending: item.shippingCostPending ?? undefined,
			freeItemCategory: (item.freeDetails?.category as FreeItemCategory) ?? undefined,
			freeItemDescription: item.freeDetails?.description ?? undefined,
			freeItemUnitCost: item.freeDetails?.unitCost ?? undefined,
			freeItemSupplierId: item.freeDetails?.supplierId ?? undefined,
			freeItemOpticalNotes: item.freeDetails?.opticalNotes ?? undefined,
			notes: item.notes ?? undefined,
			_removed: false
		};
	}

	function buildLensInputFromDraft(): EditableItem {
		const lensName = selectedLens?.name ?? editLensTmp.snapshotName;
		const supplierName = selectedLens?.supplier?.name ?? editLensTmp.snapshotBrand;
		return {
			...editLensTmp,
			snapshotName: lensName,
			snapshotBrand: supplierName,
			snapshotBaseCost: selectedLens?.pairPurchasePrice ?? editLensTmp.snapshotBaseCost,
			snapshotMountingPrice: selectedLens?.mountingPrice ?? editLensTmp.snapshotMountingPrice,
			snapshotShippingPrice: editLensTmp.shippingCostPending ? undefined : (selectedLens?.shippingPrice ?? editLensTmp.snapshotShippingPrice),
			snapshotSalePrice: selectedLens?.salePrice ?? editLensTmp.snapshotSalePrice,
			snapshotPriceType: selectedLens?.priceType ?? editLensTmp.snapshotPriceType,
			snapshotIsTaxable: selectedLens?.isTaxable ?? editLensTmp.snapshotIsTaxable ?? true
		};
	}

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
		const savedItem = buildLensInputFromDraft();
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
		if (!addProductId) { toast.error('Seleccione un producto'); return; }
		const product = products.find((p) => p.id === addProductId);
		if (!product) { toast.error('Producto no encontrado'); return; }

		editableItems = [...editableItems, {
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
		}];
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
			toast.error('La descripción debe tener al menos 3 caracteres'); return;
		}
		if (addFreePrice <= 0) { toast.error('El precio de venta debe ser mayor a 0'); return; }

		editableItems = [...editableItems, {
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
		}];
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
		reasonError = '';
		if (!reason.trim()) {
			reasonError = 'El motivo de la modificación es obligatorio';
			return false;
		}
		if (activeItems.length === 0) {
			toast.error('La venta debe tener al menos un artículo');
			return false;
		}
		return true;
	}

	async function handleSubmit() {
		if (!validate()) return;
		saving = true;

		const payload: UpdateSaleInput = { id: sale.id, reason: reason.trim() };

		if (saleDate !== sale.saleDate.slice(0, 10)) {
			payload.saleDate = new Date(saleDate + 'T12:00:00').toISOString();
		}
		if (notes !== (sale.notes ?? '')) {
			payload.notes = notes || undefined;
		}
		if (discount !== sale.discount) payload.discount = discount;
		if (discountType !== sale.discountType) payload.discountType = discountType as DiscountTypeEnum;

		if (removedCount > 0 || activeItems.some((i) => !i.id)) {
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
			console.error(e);
			toast.error(getErrorMessage(e, 'Error actualizando venta'));
		} finally {
			saving = false;
		}
	}

	function handleClose() {
		if (saving) return;
		open = false;
	}

	function itemDetail(item: EditableItem): string {
		const parts: string[] = [];
		if (item.snapshotSku) parts.push(item.snapshotSku);
		if (item.snapshotBrand) parts.push(item.snapshotBrand);
		if (item.itemType === SaleItemType.FREE_ITEM && item.freeItemCategory) {
			parts.push(item.freeItemCategory);
		}
		return parts.join(' · ');
	}
</script>

{#if open}
	<!-- Overlay -->
	<div class="fixed inset-0 z-50" transition:fade={{ duration: 200 }}>
		<div class="fixed inset-0 bg-black/50 backdrop-blur-sm"></div>

		<!-- Slide-over panel -->
		<div
			class="fixed right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-slate-900"
			transition:fly={{ x: '100%', duration: 250, easing: (t) => 1 - Math.pow(1 - t, 3) }}
		>
			<!-- ═══ HEADER — Fixed ═══ -->
			<header class="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
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
					onclick={handleClose}
					disabled={saving}
					class="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-300"
				>
					<X class="h-5 w-5" />
				</button>
			</header>

			<!-- ═══ BODY — Scrollable ═══ -->
			<div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
				<!-- ── Card: Información General ── -->
				<section class="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
					<div class="mb-4 flex items-center gap-2">
						<CalendarDays class="h-4 w-4 text-brand-blue" />
						<h3 class="text-sm font-bold text-brand-navy dark:text-white">Información General</h3>
					</div>
					<div class="grid gap-4 md:grid-cols-3">
						<div>
							<label for="edit-sale-date" class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">Fecha de venta</label>
							<input id="edit-sale-date" type="date" bind:value={saleDate}
								class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light" />
						</div>
						<div>
							<label for="edit-customer" class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">Cliente</label>
							<div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
								<User class="h-4 w-4 text-slate-400" />
								<span class="truncate">{sale.customer?.firstName} {sale.customer?.lastName}</span>
							</div>
						</div>
						<div>
							<label for="edit-sale-notes" class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">Observaciones</label>
							<input id="edit-sale-notes" type="text" bind:value={notes} placeholder="Notas opcionales..."
								class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light" />
						</div>
					</div>
				</section>

				<!-- ── Card: Descuento ── -->
				<section class="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
					<div class="mb-4 flex items-center gap-2">
						<Tag class="h-4 w-4 text-brand-blue" />
						<h3 class="text-sm font-bold text-brand-navy dark:text-white">Descuento</h3>
					</div>
					<div class="grid gap-4 md:grid-cols-2">
						<div>
							<label for="edit-discount-type" class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">Tipo</label>
							<select id="edit-discount-type" bind:value={discountType}
								class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light">
								<option value={DiscountType.FIXED}>Monto fijo ($)</option>
								<option value={DiscountType.PERCENTAGE}>Porcentaje (%)</option>
							</select>
						</div>
						<div>
							<label for="edit-discount" class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">
								Valor {discountType === DiscountType.PERCENTAGE ? '(%)' : '($)'}
							</label>
							<input id="edit-discount" type="number" bind:value={discount} min="0" step="0.01"
								class="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light" />
						</div>
					</div>
				</section>

				<!-- ── Card: Artículos ── -->
				<section class="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Package class="h-4 w-4 text-brand-blue" />
							<h3 class="text-sm font-bold text-brand-navy dark:text-white">Artículos ({activeItems.length})</h3>
						</div>
						<div class="flex gap-1.5">
							<button type="button" onclick={() => { closeAllAddFormsExcept('lens'); startLensAdd(); }}
								class="inline-flex items-center gap-1 rounded-lg bg-cyan-100 px-2.5 py-1.5 text-[11px] font-bold text-cyan-800 transition-colors hover:bg-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-300 dark:hover:bg-cyan-900">
								<Plus class="h-3 w-3" /> Cristal
							</button>
							<button type="button" onclick={() => { closeAllAddFormsExcept('product'); showAddProduct = !showAddProduct; }}
								class="inline-flex items-center gap-1 rounded-lg bg-brand-navy/10 px-2.5 py-1.5 text-[11px] font-bold text-brand-navy transition-colors hover:bg-brand-navy/20 dark:bg-brand-navy/30 dark:text-white dark:hover:bg-brand-navy/50">
								<Plus class="h-3 w-3" /> Producto
							</button>
							<button type="button" onclick={() => { closeAllAddFormsExcept('free'); showAddFreeItem = !showAddFreeItem; }}
								class="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900">
								<Plus class="h-3 w-3" /> Ítem libre
							</button>
						</div>
					</div>

					<!-- Add product form -->
					{#if showAddProduct}
						<div transition:slide={{ duration: 180 }} class="mb-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
							<p class="mb-3 text-xs font-bold text-brand-navy dark:text-white">Agregar producto</p>
							<div class="space-y-3">
								<ItemSelect kind="product" value={addProductId} {products} onselect={handleProductSelect} label="Producto" />
								<div class="grid grid-cols-3 gap-3">
									<div>
										<label for="add-prod-qty" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Cant.</label>
										<input id="add-prod-qty" type="number" bind:value={addProductQty} min="1"
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
									</div>
									<div>
										<label for="add-prod-price" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Precio</label>
										<input id="add-prod-price" type="number" bind:value={addProductPrice} min="0" step="0.01"
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
									</div>
									<div>
										<label for="add-prod-discount" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Desc.</label>
										<input id="add-prod-discount" type="number" bind:value={addProductDiscount} min="0" step="0.01"
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
									</div>
								</div>
								<div class="flex items-center gap-3">
									<select bind:value={addProductDiscountType}
										class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white">
										<option value={DiscountType.FIXED}>Fijo ($)</option>
										<option value={DiscountType.PERCENTAGE}>%</option>
									</select>
									<input type="text" bind:value={addProductNotes} placeholder="Notas (opcional)"
										class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
								</div>
								<div class="flex justify-end gap-2">
									<button type="button" onclick={resetAddProductForm}
										class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">Cancelar</button>
									<button type="button" onclick={addNewProduct} disabled={!addProductId}
										class="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50">Agregar</button>
								</div>
							</div>
						</div>
					{/if}

					<!-- Add free item form -->
					{#if showAddFreeItem}
						<div transition:slide={{ duration: 180 }} class="mb-3 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-slate-800">
							<p class="mb-3 text-xs font-bold text-amber-800 dark:text-amber-300">Agregar ítem libre</p>
							<div class="space-y-3">
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label for="add-free-cat" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Categoría</label>
										<select id="add-free-cat" bind:value={addFreeCategory}
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white">
											{#each ALL_FREE_ITEM_CATEGORIES as cat (cat)}
												<option value={cat}>{cat}</option>
											{/each}
										</select>
									</div>
									<div>
										<label for="add-free-price" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Precio venta</label>
										<input id="add-free-price" type="number" bind:value={addFreePrice} min="0" step="0.01"
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
									</div>
								</div>
								<div>
									<label for="add-free-desc" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Descripción</label>
									<input id="add-free-desc" type="text" bind:value={addFreeDescription} placeholder="Ej: Funda antivuelco"
										class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
								</div>
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label for="add-free-discount" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Descuento</label>
										<input id="add-free-discount" type="number" bind:value={addFreeDiscount} min="0" step="0.01"
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
									</div>
									<div>
										<label for="add-free-discount-type" class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Tipo</label>
										<select id="add-free-discount-type" bind:value={addFreeDiscountType}
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white">
											<option value={DiscountType.FIXED}>Fijo ($)</option>
											<option value={DiscountType.PERCENTAGE}>%</option>
										</select>
									</div>
								</div>
								<div class="flex justify-end gap-2">
									<button type="button" onclick={resetAddFreeItemForm}
										class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">Cancelar</button>
									<button type="button" onclick={addNewFreeItem} disabled={!addFreeDescription.trim() || addFreePrice <= 0}
										class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-700 disabled:opacity-50">Agregar</button>
								</div>
							</div>
						</div>
					{/if}

					<!-- Add / Edit lens form -->
					{#if showAddLens || editingLensId}
						<div transition:slide={{ duration: 180 }} class="mb-3 rounded-lg border border-sky-200 bg-white p-4 dark:border-sky-800 dark:bg-slate-800">
							<p class="mb-3 text-xs font-bold text-sky-800 dark:text-sky-300">
								{editingLensId ? 'Editar cristal' : 'Agregar cristal'}
							</p>
							<div class="space-y-3">
								<ItemSelect kind="lens" value={editLensTmp.lensCatalogItemId ?? ''} {lensItems} onselect={handleLensSelect} label="Cristal" />
								<div class="grid grid-cols-4 gap-3">
									<div>
										<label class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Cant.</label>
										<input type="number" bind:value={editLensTmp.quantity} min="1"
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
									</div>
									<div>
										<label class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Precio</label>
										<input type="number" bind:value={editLensTmp.unitPrice} min="0" step="0.01"
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
									</div>
									<div>
										<label class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Desc.</label>
										<input type="number" bind:value={editLensTmp.discount} min="0" step="0.01"
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
									</div>
									<div>
										<label class="mb-1 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Tipo desc.</label>
										<select bind:value={editLensTmp.discountType}
											class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white">
											<option value={DiscountType.FIXED}>$</option>
											<option value={DiscountType.PERCENTAGE}>%</option>
										</select>
									</div>
								</div>
								<!-- Prescription compacta -->
								<div class="space-y-3">
									<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Receta Óptica</p>

									<!-- OD (Ojo Derecho) -->
									<div class="space-y-1">
										<span class="text-xs font-semibold text-slate-700 dark:text-slate-300">OD (Ojo Derecho)</span>
										<div class="grid gap-2" class:grid-cols-4={showAddition} class:grid-cols-3={!showAddition}>
											<span class="text-[10px] font-medium text-slate-500">Esf</span>
											<span class="text-[10px] font-medium text-slate-500">Cil</span>
											<span class="text-[10px] font-medium text-slate-500">Eje</span>
											{#if showAddition}
												<span class="text-[10px] font-medium text-slate-500">Add</span>
											{/if}
										</div>
										<div class="grid gap-2" class:grid-cols-4={showAddition} class:grid-cols-3={!showAddition}>
											<input type="number" bind:value={editLensTmp.odSphere} step="0.25" placeholder="—"
												class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
											<input type="number" bind:value={editLensTmp.odCylinder} step="0.25" min={-10} max={0} placeholder="—"
												class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
											<input type="number" bind:value={editLensTmp.odAxis} step="1" min={0} max={180} placeholder="—"
												class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
											{#if showAddition}
												<input type="number" bind:value={editLensTmp.odAddition} step="0.25" min={0} max={5} placeholder="—"
													class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
											{/if}
										</div>
									</div>

									<!-- OI (Ojo Izquierdo) -->
									<div class="space-y-1">
										<span class="text-xs font-semibold text-slate-700 dark:text-slate-300">OI (Ojo Izquierdo)</span>
										<div class="grid gap-2" class:grid-cols-4={showAddition} class:grid-cols-3={!showAddition}>
											<span class="text-[10px] font-medium text-slate-500">Esf</span>
											<span class="text-[10px] font-medium text-slate-500">Cil</span>
											<span class="text-[10px] font-medium text-slate-500">Eje</span>
											{#if showAddition}
												<span class="text-[10px] font-medium text-slate-500">Add</span>
											{/if}
										</div>
										<div class="grid gap-2" class:grid-cols-4={showAddition} class:grid-cols-3={!showAddition}>
											<input type="number" bind:value={editLensTmp.osSphere} step="0.25" placeholder="—"
												class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
											<input type="number" bind:value={editLensTmp.osCylinder} step="0.25" min={-10} max={0} placeholder="—"
												class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
											<input type="number" bind:value={editLensTmp.osAxis} step="1" min={0} max={180} placeholder="—"
												class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
											{#if showAddition}
												<input type="number" bind:value={editLensTmp.osAddition} step="0.25" min={0} max={5} placeholder="—"
													class="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
											{/if}
										</div>
									</div>
								</div>
								<div>
									<div class="mb-2 flex items-center justify-between">
										<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Tratamientos ({editLensTreatments.length})</p>
										<select
											value=""
											disabled={selectableTreatments.length === 0}
											onchange={(e: Event) => {
												const target = e.target as HTMLSelectElement;
												const val = target.value;
												if (val) { addTreatmentFromSelect(val); target.value = ''; }
											}}
											class="w-44 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
											<option value="" disabled>{selectableTreatments.length === 0 ? 'No hay más disponibles' : 'Agregar tratamiento...'}</option>
											{#each selectableTreatments as t (t.id)}
												<option value={t.id}>{t.name} — {formatPrice(t.salePrice ?? t.price)} <span class="text-xs">/ ojo</span></option>
											{/each}
										</select>
									</div>
									{#if editLensTreatments.length === 0}
										<p class="text-xs text-slate-400 italic">Sin tratamientos seleccionados</p>
									{:else}
										<div class="space-y-1">
											{#each editLensTreatments as t, idx (t.supplierTreatmentId + idx)}
												<div class="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-700">
													<FlaskConical class="h-3.5 w-3.5 shrink-0 text-purple-600" />
													<span class="flex-1 font-medium text-slate-800 dark:text-slate-200">{t.name}</span>
													<span class="font-mono text-slate-600 dark:text-slate-400">{formatPrice(t.salePrice * 2)}</span>
													<button type="button" onclick={() => removeTreatmentFromEdit(idx)}
														class="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
														title="Quitar tratamiento">
														<X class="h-3.5 w-3.5" />
													</button>
												</div>
											{/each}
										</div>
									{/if}
								</div>
								<div class="flex justify-end gap-2 pt-1">
									<button type="button" onclick={cancelLensEdit}
										class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">Cancelar</button>
									<button type="button" onclick={saveLensEdit} disabled={!editLensTmp.lensCatalogItemId || editLensTmp.unitPrice <= 0}
										class="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-800 disabled:opacity-50">
										<Save class="h-3.5 w-3.5" /> {editingLensId ? 'Guardar cambios' : 'Agregar cristal'}
									</button>
								</div>
							</div>
						</div>
					{/if}

					<!-- Items list -->
					<div class="space-y-2">
						{#each mainItems as item, i (item.id || i)}
							{@const Icon = item.itemType === SaleItemType.LENS_PAIR ? Eye : item.itemType === SaleItemType.FREE_ITEM ? Sparkles : item.itemType === SaleItemType.TREATMENT ? FlaskConical : Package}
							<div
								class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500"
								class:opacity-50={editingLensId === item.id}
							>
								<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
									{item.itemType === SaleItemType.LENS_PAIR ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300' :
									 item.itemType === SaleItemType.FREE_ITEM ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
									 item.itemType === SaleItemType.TREATMENT ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' :
									 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}">
									<Icon class="h-4 w-4" />
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="truncate text-sm font-semibold text-brand-navy dark:text-white">
											{item.itemType === SaleItemType.FREE_ITEM ? (item.freeItemDescription ?? 'Ítem libre') : (item.snapshotName ?? 'Artículo')}
										</span>
										<span class="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase
											{item.itemType === SaleItemType.LENS_PAIR ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300' :
											 item.itemType === SaleItemType.FREE_ITEM ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
											 item.itemType === SaleItemType.TREATMENT ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' :
											 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}">
											{item.itemType === SaleItemType.LENS_PAIR ? 'Cristal' :
											 item.itemType === SaleItemType.FREE_ITEM ? 'Ítem Libre' :
											 item.itemType === SaleItemType.TREATMENT ? 'Tratamiento' : 'Producto'}
										</span>
										{#if !item.id}
											<span class="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-bold tracking-wide text-green-700 uppercase dark:bg-green-900/50 dark:text-green-300">Nuevo</span>
										{/if}
									</div>
									{#if itemDetail(item)}
										<p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{itemDetail(item)}</p>
									{/if}
								</div>
								<div class="text-right">
									<p class="font-mono text-sm font-semibold text-brand-navy dark:text-white">{formatPrice(item.unitPrice)}</p>
									<p class="text-xs text-slate-500 dark:text-slate-400">x{item.quantity}</p>
								</div>
								{#if item.itemType === SaleItemType.LENS_PAIR}
									<button type="button" onclick={() => startLensEdit(item)} disabled={!!editingLensId || saving}
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-30 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400"
										title="Editar cristal">
										<Pencil class="h-3.5 w-3.5" />
									</button>
								{/if}
								<button type="button" onclick={() => removeItem(item)} disabled={!!editingLensId || saving}
									class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/30 dark:hover:text-red-400"
									title="Eliminar">
									<X class="h-4 w-4" />
								</button>
							</div>

							{#if item.itemType === SaleItemType.LENS_PAIR}
								{@const childTreatments = activeItems.filter((ci) => ci.parentSaleItemId === item.id && ci.itemType === SaleItemType.TREATMENT)}
								{#each childTreatments as treatment (treatment.id)}
									<div class="ml-8 flex items-center gap-3 rounded-lg border border-dashed border-purple-200 bg-purple-50/40 px-4 py-2 dark:border-purple-800 dark:bg-purple-900/20">
										<FlaskConical class="h-3.5 w-3.5 shrink-0 text-purple-500" />
										<span class="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300">{treatment.snapshotName ?? 'Tratamiento'}</span>
										<span class="font-mono text-xs text-slate-500 dark:text-slate-400">{formatPrice(treatment.unitPrice)}</span>
									</div>
								{/each}
							{/if}
						{/each}

						{#if mainItems.length === 0}
							<div class="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400 dark:border-slate-600">
								No hay artículos en esta venta. Agregue al menos uno.
							</div>
						{/if}
					</div>
				</section>

				<!-- ── Card: Resumen ── -->
				<section class="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
					<div class="mb-4 flex items-center gap-2">
						<Calculator class="h-4 w-4 text-brand-blue" />
						<h3 class="text-sm font-bold text-brand-navy dark:text-white">Resumen</h3>
					</div>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-slate-600 dark:text-slate-400">Subtotal</span>
							<span class="font-semibold text-slate-800 dark:text-white">
								{formatPrice(activeItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0))}
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
			</div>

			<!-- ═══ FOOTER — Fixed ═══ -->
			<footer class="shrink-0 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
				<div class="space-y-3">
					<!-- Reason field -->
					<div>
						<label for="edit-reason" class="mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">
							Motivo de la modificación <span class="text-red-500">*</span>
						</label>
						<textarea id="edit-reason" bind:value={reason} oninput={() => (reasonError = '')}
							rows="2" placeholder="Explique por qué está modificando esta venta..."
							class="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-brand-blue-light"></textarea>
						{#if reasonError}<p class="mt-1 text-xs text-red-600">{reasonError}</p>{/if}
					</div>

					<!-- Actions -->
					<div class="flex items-center justify-between gap-3">
						<div class="text-xs text-slate-500 dark:text-slate-400">
							{#if removedCount > 0}
								<span class="text-red-600 dark:text-red-400">{removedCount} artículo(s) eliminado(s)</span>
							{/if}
						</div>
						<div class="flex gap-2">
							<button type="button" onclick={handleClose} disabled={saving}
								class="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800">
								Cancelar
							</button>
							<button type="button" onclick={handleSubmit} disabled={saving || !hasChanges}
								class="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-navy-dark disabled:opacity-50">
								{#if saving}
									<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
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
	</div>
{/if}
