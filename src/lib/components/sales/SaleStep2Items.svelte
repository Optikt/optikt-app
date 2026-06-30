<script lang="ts">
	import { untrack } from 'svelte';
	import { Input, Label } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import 	{
		Trash2,
		ChevronRight,
		Eye,
		FlaskConical,
		Search,
		Package,
		Paperclip,
		Sparkles,
		X,
		Copy
	} from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import { getAccessoriesForProduct } from '$lib/remote/brandAccessories.remote';
	import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { DiscountType, TreatmentCategory, LensCatalogSource } from '$lib/shared/enums';
	import {
		getLensTypeLabel,
		getLensSourceLabel,
		getTreatmentCategoryLabel,
		getFreeItemCategoryLabel,
		ALL_FREE_ITEM_CATEGORIES,
		ALL_LENS_TYPES
	} from '$lib/shared/enums/lensTypes';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { listSupplierTreatments } from '$lib/remote/suppliers.remote';
	import {
		findProduct,
		findLensItem,
		getAvailableProductStock,
		getLensRangeWarningsForItem,
		buildStep2PrescriptionConfirmation,
		step2ItemLineTotal,
		validateLensPrescription,
		hasLensPrescriptionErrors
	} from './saleItemHelpers';
	import type { PrescriptionFieldErrors } from './saleItemHelpers';
	import type { Customer, Prescription } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';
	import { createEmptyLensPair, createEmptyFreeItemData } from './newSaleTypes';
	import {
		allowsDuplicateProductLines,
		canAutoIncludeAccessories,
		linkIncludedAccessories,
		removeItemWithIncludedAccessories,
		type IncludedAccessoryMap
	} from './includedAccessories';
	import SaleWizardFloatingActions from './SaleWizardFloatingActions.svelte';

	interface Props {
		items: SaleItemRow[];
		includedAccessoryMap: IncludedAccessoryMap;
		customerPrescription: Prescription | null;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		nextOrderNumber?: number;
		entityNumberLabel?: string;
		customerFallbackName?: string;
		customerFallbackDocument?: string;
		newCustomerContextLabel?: string;
		selectedCustomerContextLabel?: string;
		noCustomerContextLabel?: string;
		itemsSectionTitle?: string;
		onCancel?: () => void;
		valid: boolean;
		onnext: () => void;
		onprev: () => void;
	}

	let {
		items = $bindable(),
		includedAccessoryMap = $bindable(),
		customerPrescription,
		selectedCustomer,
		newCustomer,
		products,
		lensItems,
		nextOrderNumber,
		entityNumberLabel = 'Orden #',
		customerFallbackName = 'Venta de mostrador',
		customerFallbackDocument = 'Sin cliente asignado',
		newCustomerContextLabel = 'Cliente nuevo en esta venta',
		selectedCustomerContextLabel = 'Cliente asociado',
		noCustomerContextLabel = 'Venta sin cliente',
		itemsSectionTitle = 'Artículos de la venta',
		onCancel,
		valid,
		onnext,
		onprev
	}: Props = $props();

	interface QuickAddOption {
		key: string;
		id: string;
		kind: 'product' | 'lens';
		name: string;
		label: string;
		secondaryText: string;
		stock: number | null;
		brandId?: string | null;
		productType?: string;
		inventoryMode?: string;
		price: number;
	}

	interface IncludedAccessoryRule {
		ruleId: number;
		accessoryProductId: string;
		priceMode: BrandAccessoryPriceMode;
		customPrice: number | null;
		currentProductPrice: number | null;
		accessory: {
			id: string;
			name: string;
			sku: string;
			stock: number;
			type: string;
		};
	}

	function resolveIncludedAccessoryPrice(accessoryRule: IncludedAccessoryRule): number {
		switch (accessoryRule.priceMode) {
			case BrandAccessoryPriceMode.PRODUCT:
				return accessoryRule.currentProductPrice ?? 0;
			case BrandAccessoryPriceMode.CUSTOM:
				return accessoryRule.customPrice ?? 0;
			case BrandAccessoryPriceMode.COURTESY:
			default:
				return 0;
		}
	}

	type QuickAddFilter = 'all' | 'product' | 'lens';

	const quickAddFilterOptions: { value: QuickAddFilter; label: string }[] = [
		{ value: 'all', label: 'Todo' },
		{ value: 'product', label: 'Productos' },
		{ value: 'lens', label: 'Lentes' }
	];

	let quickAddQuery = $state('');
	let quickAddOpen = $state(false);
	let quickAddFilter = $state<QuickAddFilter>('all');
	let costOpenFor = $state<string | null>(null);
	let prescriptionOpenFor = $state<string | null>(null);

	const quickAddPlaceholder = $derived.by(() => {
		if (quickAddFilter === 'product') return 'Buscar producto por nombre o código...';
		if (quickAddFilter === 'lens') return 'Buscar lente por nombre, material o tipo...';
		return 'Buscar items...';
	});

	const quickAddOptions = $derived.by((): QuickAddOption[] => {
		const selectedProductIds = new Set(
			items
				.filter((item) => item.kind === 'product' && item.productId !== '')
				.filter((item) => {
					const selectedProduct = products.find((candidate) => candidate.id === item.productId);
					return !allowsDuplicateProductLines(selectedProduct?.type);
				})
				.map((item) => item.productId)
		);

		const productOptions =
			quickAddFilter === 'lens'
				? []
				: products.flatMap((product) => {
						if (selectedProductIds.has(product.id)) return [];
						if (product.stock !== null && product.stock <= 0) return [];

						const secondaryBits = [product.brand?.name, product.sku].filter(
							(value): value is string => Boolean(value)
						);

						return [
							{
								key: `product:${product.id}`,
								id: product.id,
								kind: 'product' as const,
								name: product.name,
								label: product.sku ? `${product.name} (${product.sku})` : product.name,
								secondaryText: secondaryBits.join(' · '),
								stock: product.stock,
								brandId: product.brandId ?? null,
								productType: product.type,
								price: product.currentSalePrice ?? 0
							}
						];
					});

		const lensOptions =
			quickAddFilter === 'product'
				? []
				: lensItems.map((lens) => {
						const secondaryBits = [
							getLensSourceLabel(lens.source),
							getLensTypeLabel(lens.type),
							lens.material?.name
						].filter((value): value is string => Boolean(value));

						return {
							key: `lens:${lens.id}`,
							id: lens.id,
							kind: 'lens' as const,
							name: lens.name,
							label: lens.name,
							secondaryText: secondaryBits.join(' · '),
							stock: lens.stock,
							inventoryMode: lens.inventoryMode,
							price: lens.salePrice ?? lens.basePrice
						};
					});

		return [...productOptions, ...lensOptions];
	});

	const visibleQuickAddOptions = $derived.by(() => {
		const query = quickAddQuery.trim().toLowerCase();
		if (query.length < 2) return [];

		return quickAddOptions.filter((option) => {
			const searchableText = `${option.name} ${option.label} ${option.secondaryText}`.toLowerCase();
			return searchableText.includes(query);
		});
	});

	const visibleProductQuickAddOptions = $derived(
		visibleQuickAddOptions.filter((option) => option.kind === 'product')
	);

	const visibleLensQuickAddOptions = $derived(
		visibleQuickAddOptions.filter((option) => option.kind === 'lens')
	);

	const totalQuickAddResults = $derived(visibleQuickAddOptions.length);

	// ============================================================================
	// ITEMS MANAGEMENT
	// ============================================================================

	const hasLensItem = $derived(items.some((i) => i.kind === 'lens'));

	function createEmptyItem(): SaleItemRow {
		return {
			id: crypto.randomUUID(),
			kind: 'product',
			isIncludedAccessory: false,
			includedAccessoryParentItemId: null,
			productId: '',
			quantity: 1,
			lensPair: null,
			treatments: [],
			freeItem: null,
			unitPrice: 0,
			discount: 0,
			discountType: DiscountType.FIXED,
			notes: '',
			costOverrides: null,
			shippingCostPending: false
		};
	}

	function createIncludedAccessoryItem(
		parentItemId: string,
		accessoryRule: IncludedAccessoryRule
	): SaleItemRow {
		return {
			...createEmptyItem(),
			productId: accessoryRule.accessoryProductId,
			unitPrice: resolveIncludedAccessoryPrice(accessoryRule),
			isIncludedAccessory: true,
			includedAccessoryParentItemId: parentItemId
		};
	}

	function getAvailableStockForProduct(productId: string, excludeItemId?: string): number | null {
		return getAvailableProductStock(items, products, productId, excludeItemId);
	}

	function createItemFromQuickAdd(option: QuickAddOption): SaleItemRow {
		const item = createEmptyItem();
		item.kind = option.kind;

		if (option.kind === 'product') {
			item.productId = option.id;
			item.unitPrice = option.price;
			return item;
		}

		item.lensPair = createEmptyLensPair();
		item.lensPair.catalogItemId = option.id;

		// Initialize cost overrides from catalog values and auto-set lens type
		const lens = lensItems.find((l) => l.id === option.id);
		if (lens) {
			item.costOverrides = {
				baseCost: lens.pairPurchasePrice,
				mountingPrice: lens.mountingPrice,
				shippingPrice: lens.shippingPrice
			};
			item.lensPair.lensType = lens.type;
		}

		recalcSuggestedPrice(item);
		return item;
	}

	function closeQuickAdd() {
		quickAddOpen = false;
	}

	function resetQuickAdd() {
		quickAddQuery = '';
		quickAddOpen = false;
	}

	function handleQuickAddInput() {
		quickAddOpen = quickAddQuery.trim().length >= 2;
	}

	function handleQuickAddBlur() {
		setTimeout(() => {
			quickAddOpen = false;
		}, 200);
	}

	function setQuickAddFilter(filter: QuickAddFilter) {
		quickAddFilter = filter;
		quickAddOpen = quickAddQuery.trim().length >= 2;
	}

	async function addIncludedAccessoriesForItem(option: QuickAddOption, parentItem: SaleItemRow) {
		if (
			option.kind !== 'product' ||
			!option.brandId ||
			!canAutoIncludeAccessories(option.productType)
		) {
			return;
		}

		try {
			const accessories = await getAccessoriesForProduct({
				productId: option.id,
				brandId: option.brandId
			}).run();

			if (!items.some((item) => item.id === parentItem.id)) {
				return;
			}

			const addedNames: string[] = [];
			const linkedIds: string[] = [];
			const accessoryItems: SaleItemRow[] = [];

			for (const accessoryRule of accessories as IncludedAccessoryRule[]) {
				if (accessoryRule.accessory.stock <= 0) {
					toast.warning(
						`⚠ ${accessoryRule.accessory.name} no tiene stock disponible y no fue agregado automáticamente.`
					);
					continue;
				}

				const accessoryItem = createIncludedAccessoryItem(parentItem.id, accessoryRule);
				accessoryItems.push(accessoryItem);
				linkedIds.push(accessoryItem.id);
				addedNames.push(accessoryRule.accessory.name);
			}

			if (accessoryItems.length === 0) {
				return;
			}

			items = [...items, ...accessoryItems];
			includedAccessoryMap = linkIncludedAccessories(
				includedAccessoryMap,
				parentItem.id,
				linkedIds
			);

			if (addedNames.length > 1) {
				toast.info(`✓ Se agregaron automáticamente: ${addedNames.join(', ')}`);
			}
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error cargando accesorios incluidos'));
		}
	}

	async function selectQuickAddOption(option: QuickAddOption) {
		if (option.kind === 'product' && !allowsDuplicateProductLines(option.productType)) {
			const alreadySelected = items.some(
				(item) => item.kind === 'product' && item.productId === option.id
			);
			if (alreadySelected) {
				resetQuickAdd();
				return;
			}
		}

		const nextItem = createItemFromQuickAdd(option);
		items = [...items, nextItem];
		resetQuickAdd();

		await addIncludedAccessoriesForItem(option, nextItem);
	}

	function handleQuickAddKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeQuickAdd();
			return;
		}

		if (event.key === 'Enter' && visibleQuickAddOptions.length > 0) {
			event.preventDefault();
			void selectQuickAddOption(visibleQuickAddOptions[0]);
		}
	}

	function removeItem(id: string) {
		const nextState = removeItemWithIncludedAccessories(items, includedAccessoryMap, id);
		items = nextState.items;
		includedAccessoryMap = nextState.includedAccessoryMap;
	}

	function addFreeItem() {
		const item: SaleItemRow = {
			id: crypto.randomUUID(),
			kind: 'free',
			isIncludedAccessory: false,
			includedAccessoryParentItemId: null,
			productId: '',
			quantity: 1,
			lensPair: null,
			treatments: [],
			freeItem: createEmptyFreeItemData(),
			unitPrice: 0,
			discount: 0,
			discountType: DiscountType.FIXED,
			notes: '',
			costOverrides: null,
			shippingCostPending: false
		};
		items = [...items, item];
	}

	// ============================================================================
	// TREATMENTS
	// ============================================================================

	/** Cache of treatments per supplier to avoid re-fetching */
	let treatmentCache = $state<Record<string, SupplierTreatment[]>>({});

	async function loadTreatmentsForSupplier(supplierId: string): Promise<SupplierTreatment[]> {
		if (treatmentCache[supplierId]) return treatmentCache[supplierId];
		const treatments = await listSupplierTreatments({ supplierId });
		treatmentCache[supplierId] = treatments.filter((t) => t.isActive);
		return treatmentCache[supplierId];
	}

	function getAvailableTreatments(item: SaleItemRow): SupplierTreatment[] {
		if (item.kind !== 'lens' || !item.lensPair?.catalogItemId) return [];
		const lens = lensItems.find((l) => l.id === item.lensPair!.catalogItemId);
		if (!lens?.supplier) return [];
		// FINISHED lenses come with coatings already applied - no treatments to add
		if (lens.source === LensCatalogSource.FINISHED) return [];
		return treatmentCache[lens.supplier.id] ?? [];
	}

	function toggleTreatment(item: SaleItemRow, treatment: SupplierTreatment) {
		const idx = item.treatments.findIndex((t) => t.supplierTreatmentId === treatment.id);
		if (idx >= 0) {
			item.treatments = item.treatments.filter((t) => t.supplierTreatmentId !== treatment.id);
		} else {
			// Replace any existing treatment of the same category (max 1 per category)
			item.treatments = [
				...item.treatments.filter((t) => t.category !== treatment.category),
				{
					supplierTreatmentId: treatment.id,
					name: treatment.name,
					category: treatment.category,
					price: treatment.salePrice ?? treatment.price,
					isTaxable: treatment.isTaxable
				}
			];
		}
	}

	function isTreatmentSelected(item: SaleItemRow, treatmentId: string): boolean {
		return item.treatments.some((t) => t.supplierTreatmentId === treatmentId);
	}

	// Load treatments when a lens item's supplier changes (only for LAB lenses)
	$effect(() => {
		const lensItemsInCart = items.filter((i) => i.kind === 'lens' && i.lensPair?.catalogItemId);
		untrack(() => {
			for (const item of lensItemsInCart) {
				const lens = lensItems.find((l) => l.id === item.lensPair!.catalogItemId);
				if (lens?.supplier?.id && lens.source !== LensCatalogSource.FINISHED) {
					loadTreatmentsForSupplier(lens.supplier.id);
				}
			}
		});
	});

	// ============================================================================
	// PRESCRIPTION SYNC
	// ============================================================================

	function parseNullableNum(v: string): number | null {
		if (v === '') return null;
		const n = parseFloat(v);
		return isNaN(n) ? null : n;
	}

	function setFreeItemUnitCost(item: SaleItemRow, value: string) {
		if (!item.freeItem) return;
		item.freeItem.unitCost = parseNullableNum(value);
	}

	// ============================================================================
	// HELPERS
	// ============================================================================

	function getProduct(item: SaleItemRow): ProductWithRelations | undefined {
		return findProduct(item, products);
	}

	function getLensForDisplay(item: SaleItemRow): LensCatalogItemWithRelations | undefined {
		return findLensItem(item, lensItems);
	}

	function getProductMaxStock(item: SaleItemRow): number | null {
		if (item.kind === 'product' && item.productId) {
			const p = products.find((pr) => pr.id === item.productId);
			return p?.stock ?? null;
		}
		return null;
	}

	function getTreatmentTotal(item: SaleItemRow): number {
		if (item.kind !== 'lens') return 0;
		const eyeCount = getEnabledEyeCount(item);
		return item.treatments.reduce((sum, treatment) => sum + treatment.price * eyeCount, 0);
	}

	// ============================================================================
	// PRESCRIPTION VALIDATION
	// ============================================================================

	const step2PrescriptionConfirmation = $derived(
		buildStep2PrescriptionConfirmation(items, lensItems)
	);

	// ============================================================================
	// VALIDATION REASONS (for "Siguiente" button feedback)
	// ============================================================================

	function getValidationReasons(): string[] {
		const reasons: string[] = [];
		if (items.length === 0) {
			reasons.push('Agregue al menos un producto o cristal desde la búsqueda superior');
		}

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const num = i + 1;
			if (item.kind === 'product' && item.productId && item.quantity <= 0) {
				reasons.push(`Ítem #${num}: cantidad debe ser mayor a 0`);
			}
			if (item.kind === 'lens') {
				if (!item.lensPair?.od.enabled && !item.lensPair?.oi.enabled) {
					reasons.push(`Ítem #${num}: habilite al menos un ojo`);
				}
				if (hasLensPrescriptionErrors(item)) {
					reasons.push(`Ítem #${num}: complete los campos de prescripción requeridos`);
				}
			}
			if (item.kind === 'product' && item.productId) {
				const availableStock = getAvailableStockForProduct(item.productId, item.id);
				if (availableStock !== null && (availableStock <= 0 || item.quantity > availableStock)) {
					reasons.push(`Ítem #${num}: stock insuficiente (disponible: ${availableStock})`);
				}
			}
			if (item.kind === 'free') {
				if (!item.freeItem?.category) {
					reasons.push(`Ítem #${num}: seleccione una categoría para el ítem libre`);
				}
				if (!item.freeItem?.description || item.freeItem.description.trim().length < 3) {
					reasons.push(`Ítem #${num}: ingrese una descripción (mínimo 3 caracteres)`);
				}
				if (item.unitPrice <= 0) {
					reasons.push(`Ítem #${num}: el precio de venta debe ser mayor a 0`);
				}
			}
		}
		return reasons;
	}

	// ============================================================================
	// LENS COST HELPERS
	// ============================================================================

	function getEnabledEyeCount(item: SaleItemRow): number {
		if (!item.lensPair) return 0;
		return (item.lensPair.od.enabled ? 1 : 0) + (item.lensPair.oi.enabled ? 1 : 0);
	}

	/** Recalculate unitPrice to the suggested sale price for the lens only (excluding treatments).
	 *  Uses salePrice (sell price) when available, otherwise falls back to basePrice (cost). */
	function recalcSuggestedPrice(item: SaleItemRow) {
		if (item.kind !== 'lens' || !item.lensPair) return;
		const lens = lensItems.find((l) => l.id === item.lensPair!.catalogItemId);
		if (!lens) return;

		const eyeCount = getEnabledEyeCount(item);
		if (eyeCount === 0) return;

		item.unitPrice = lensSalePrice(lens, eyeCount);
	}

	/** Sale price for the lens - salePrice is always per pair. Falls back to cost (base + mounting + shipping). */
	function lensSalePrice(lens: LensCatalogItemWithRelations, _eyeCount: number): number {
		if (lens.salePrice != null && lens.salePrice > 0) {
			return lens.salePrice;
		}
		// Fallback to cost-based price
		return lens.pairPurchasePrice + lens.mountingPrice + lens.shippingPrice;
	}

	// ============================================================================
	// OPTICAL RANGE VALIDATION
	// ============================================================================

	function getRangeWarnings(item: SaleItemRow): string[] {
		if (item.kind !== 'lens' || !item.lensPair) return [];
		const pair = item.lensPair;
		const hasRx = pair.od.prescription.sphere != null || pair.od.prescription.cylinder != null ||
			pair.oi.prescription.sphere != null || pair.oi.prescription.cylinder != null;
		if (!hasRx) return [];
		return getLensRangeWarningsForItem(item.id, step2PrescriptionConfirmation);
	}

	const selectedItemCount = $derived(items.length);

	const selectedLensCount = $derived(
		items.filter((item) => item.kind === 'lens' && (item.lensPair?.catalogItemId ?? '') !== '')
			.length
	);

	const selectedTreatmentCount = $derived(
		items.reduce((count, item) => count + item.treatments.length, 0)
	);

	const coreItemsSubtotal = $derived(
		items.reduce((sum, item) => sum + step2ItemLineTotal(item), 0)
	);

	const treatmentsSubtotal = $derived(
		items.reduce((sum, item) => sum + getTreatmentTotal(item), 0)
	);

	const partialTotal = $derived(coreItemsSubtotal + treatmentsSubtotal);

	const displayCustomerName = $derived.by(() => {
		if (newCustomer) return `${newCustomer.firstName} ${newCustomer.lastName}`.trim();
		if (selectedCustomer)
			return `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim();
		return customerFallbackName;
	});

	const displayCustomerId = $derived.by(() => {
		if (newCustomer) return newCustomer.idNumber || 'Cliente nuevo sin documento';
		if (selectedCustomer) return selectedCustomer.idNumber;
		return customerFallbackDocument;
	});

	const contextStatus = $derived.by(() => {
		if (customerPrescription) return 'Fórmula previa disponible';
		if (newCustomer) return newCustomerContextLabel;
		if (selectedCustomer) return selectedCustomerContextLabel;
		if (selectedLensCount > 0) return 'Fórmula manual requerida';
		return noCustomerContextLabel;
	});

	const canCopyRxToAll = $derived(
		selectedLensCount >= 2 &&
		items.some((i) => i.kind === 'lens' && i.lensPair && (
			i.lensPair.od.prescription.sphere != null || i.lensPair.oi.prescription.sphere != null
		))
	);

	function copyFirstRxToAll() {
		const firstLens = items.find((i) => i.kind === 'lens' && i.lensPair);
		if (!firstLens?.lensPair) return;
		const src = firstLens.lensPair;
		for (const item of items) {
			if (item.kind !== 'lens' || !item.lensPair || item.id === firstLens.id) continue;
			const dest = item.lensPair;
			dest.od.prescription = { ...src.od.prescription };
			dest.oi.prescription = { ...src.oi.prescription };
			dest.lensType = src.lensType;
			dest.doctorName = src.doctorName;
		}
	}

	function copyOdToOi(pair: import('./newSaleTypes').LensPairEntry) {
		pair.oi.prescription = { ...pair.od.prescription };
	}

	const rxErrorsPerLens = $derived.by((): Record<string, PrescriptionFieldErrors> => {
		const map: Record<string, PrescriptionFieldErrors> = {};
		for (const item of items) {
			if (item.kind === 'lens') {
				map[item.id] = validateLensPrescription(item);
			}
		}
		return map;
	});
</script>

<div class="flex gap-4 items-start">
	<!-- ============================================================
	LEFT COLUMN: Customer banner + Search + Items
	============================================================ -->
	<div class="flex-1 min-w-0 space-y-4">
		<!-- Compact customer banner -->
		<div class="rounded-xl bg-brand-navy px-4 py-2.5 text-white shadow-sm">
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
				<div class="flex items-center gap-2 text-xs font-semibold">
					<span class="font-mono tracking-wide text-white/60">{entityNumberLabel} {nextOrderNumber ?? '-'}</span>
					<span class="h-3 w-px bg-white/15"></span>
					<span class="truncate max-w-[12rem]">{displayCustomerName}</span>
					<span class="font-mono text-[11px] text-white/50">{displayCustomerId}</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-white/60 uppercase">
						{contextStatus}
					</span>
				</div>
			</div>
		</div>

		<!-- Search bar -->
		<div class="rounded-xl bg-surface-container-low px-4 py-4 sm:px-5">
			<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
				<div class="relative min-w-0 flex-1 lg:max-w-3xl">
					<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
					<input
						bind:value={quickAddQuery}
						oninput={handleQuickAddInput}
						onkeydown={handleQuickAddKeydown}
						onblur={handleQuickAddBlur}
						onfocus={() => {
							if (quickAddQuery.trim().length >= 2) quickAddOpen = true;
						}}
						placeholder={quickAddPlaceholder}
						class="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-8 text-sm text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
					/>
					{#if quickAddQuery}
						<button
							type="button"
							onclick={resetQuickAdd}
							class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
						>
							<X class="h-3.5 w-3.5" />
						</button>
					{/if}

					{#if quickAddOpen}
						<div
							class="absolute top-full right-0 left-0 z-30 mt-1.5 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
						>
							{#if totalQuickAddResults > 0}
								{#if visibleProductQuickAddOptions.length > 0}
									<div class="border-b border-slate-100 px-3 pt-2.5 pb-1">
										<div
											class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-slate-400 uppercase"
										>
											<Package class="h-3 w-3" />
											Productos ({visibleProductQuickAddOptions.length})
										</div>
									</div>
									{#each visibleProductQuickAddOptions as option (option.key)}
										<button
											type="button"
											onclick={() => void selectQuickAddOption(option)}
											class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
										>
											<div
												class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
											>
												<Package class="h-4 w-4" />
											</div>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium text-slate-800">{option.name}</p>
												<p class="truncate text-xs text-slate-500">{option.secondaryText}</p>
											</div>
											<div class="text-right">
												<p class="font-mono text-sm font-medium whitespace-nowrap text-slate-700">
													{formatPrice(option.price)}
												</p>
												{#if option.stock !== null}
													<p class="text-[11px] font-medium text-emerald-600">
														{option.stock} disp.
													</p>
												{/if}
											</div>
										</button>
									{/each}
								{/if}

								{#if visibleLensQuickAddOptions.length > 0}
									<div class="border-b border-slate-100 px-3 pt-2.5 pb-1">
										<div
											class="flex items-center gap-1.5 text-xs font-medium tracking-wider text-slate-400 uppercase"
										>
											<Eye class="h-3 w-3" />
											Lentes ({visibleLensQuickAddOptions.length})
										</div>
									</div>
									{#each visibleLensQuickAddOptions as option (option.key)}
										<button
											type="button"
											onclick={() => void selectQuickAddOption(option)}
											class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
										>
											<div
												class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500"
											>
												<Eye class="h-4 w-4" />
											</div>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium text-slate-800">{option.name}</p>
												<p class="truncate text-xs text-slate-500">{option.secondaryText}</p>
											</div>
											<div class="text-right">
												<p class="font-mono text-sm font-medium whitespace-nowrap text-slate-700">
													{formatPrice(option.price)}
												</p>
												{#if option.inventoryMode === 'ON_DEMAND'}
													<p class="text-[11px] font-medium text-blue-600">Por pedido</p>
												{:else if option.stock !== null}
													<p class="text-[11px] font-medium text-slate-500">{option.stock} disp.</p>
												{/if}
											</div>
										</button>
									{/each}
								{/if}
							{:else}
								<div class="py-6 text-center">
									<p class="text-sm text-slate-500">
										Sin resultados para &quot;{quickAddQuery.trim()}&quot;
									</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<div class="inline-flex items-center gap-2">
					<div class="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
						{#each quickAddFilterOptions as option (option.value)}
							<button
								type="button"
								onclick={() => setQuickAddFilter(option.value)}
								class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors {quickAddFilter ===
								option.value
									? 'bg-brand-navy text-white'
									: 'text-slate-600 hover:bg-slate-50'}"
							>
								{option.label}
							</button>
						{/each}
					</div>

					<button
						type="button"
						onclick={addFreeItem}
						class="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
					>
						<Sparkles class="h-3.5 w-3.5" />
						Ítem Libre
					</button>
					{#if canCopyRxToAll}
						<button
							type="button"
							onclick={copyFirstRxToAll}
							class="inline-flex items-center gap-1.5 rounded-lg border border-brand-blue/30 bg-brand-blue/5 px-3 py-1.5 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue/10"
						>
							<Copy class="h-3.5 w-3.5" />
							Copiar Rx a todos
						</button>
					{/if}
		</div>
	</div>
</div>

<!-- Items list -->
		<div class="rounded-xl bg-surface-container-low px-4 py-4 sm:px-5">
			<div class="mb-3 flex items-center justify-between gap-3">
				<div>
					<h3 class="text-sm font-semibold text-brand-navy">{itemsSectionTitle}</h3>
				</div>
				<span class="rounded-full bg-surface-container-lowest px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant uppercase">
					{selectedItemCount} {selectedItemCount === 1 ? 'ítem' : 'ítems'}
				</span>
			</div>

			<div class="space-y-2" use:autoAnimate>
				{#if items.length === 0}
					<div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-lowest px-4 py-8 text-center">
						<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
							<Search class="h-4 w-4" />
						</div>
						<h4 class="mt-3 text-sm font-semibold text-brand-navy">Agrega el primer artículo desde la búsqueda</h4>
					</div>
				{:else}
					{#each items as item, index (item.id)}
						{@const product = item.kind === 'product' ? getProduct(item) : undefined}
						{@const lens = item.kind === 'lens' ? getLensForDisplay(item) : undefined}
						{@const maxStock = item.kind === 'product' ? getProductMaxStock(item) : null}
						{@const availableStock = item.kind === 'product' ? getAvailableStockForProduct(item.productId, item.id) : null}
						{@const rangeWarnings = item.kind === 'lens' ? getRangeWarnings(item) : []}
						{@const availableTreatments = item.kind === 'lens' ? getAvailableTreatments(item) : []}
						{@const eyeCount = item.kind === 'lens' ? getEnabledEyeCount(item) : 0}
						{@const treatmentTotal = item.kind === 'lens' ? getTreatmentTotal(item) : 0}

						<div class="rounded-lg p-3 shadow-sm {item.isIncludedAccessory ? 'border border-amber-200/80 bg-amber-50/70' : 'bg-surface-container-lowest'}">
							<div class="space-y-3">
								<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
									<div class="flex min-w-0 flex-1 items-start gap-2.5">
										<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {item.kind === 'lens' ? 'bg-brand-blue/15 text-brand-blue' : 'bg-surface-container-high text-brand-navy'}">
											{#if item.kind === 'lens'}<Eye class="h-3.5 w-3.5" />{:else}<Package class="h-3.5 w-3.5" />{/if}
										</div>
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-1.5">
												<p class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">Ítem {index + 1}</p>
												<span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase {item.kind === 'lens' ? 'bg-brand-blue/10 text-brand-blue' : 'bg-surface-container-high text-on-surface-variant'}">
													{item.kind === 'lens' ? 'Lente' : 'Producto'}
												</span>
												{#if item.isIncludedAccessory}
													<span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-amber-800 uppercase">
														<Paperclip class="h-2.5 w-2.5" /> Accesorio
													</span>
												{/if}
												{#if item.kind === 'product' && maxStock !== null}
													<span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase {availableStock !== null && availableStock <= 3 ? 'bg-warning-container text-on-warning-container' : 'bg-success-container text-on-success-container'}">
														{availableStock ?? maxStock} disp.
													</span>
												{/if}
											</div>
											<h4 class="truncate text-sm font-semibold text-brand-navy">
												{#if item.kind === 'product'}{product?.name ?? 'Producto por seleccionar'}{:else}{lens?.name ?? 'Lente por seleccionar'}{/if}
											</h4>
											{#if item.kind === 'product' && product}
												<p class="text-[11px] text-on-surface-variant">
													{#if product.sku}<span class="font-mono">{product.sku}</span>{/if}
													{#if product.brand}<span>{product.sku ? ' · ' : ''}{product.brand.name}</span>{/if}
												</p>
											{:else if item.kind === 'lens' && lens}
												<div class="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-on-surface-variant">
													<span class="rounded-full bg-brand-blue/10 px-1.5 py-0.5 font-semibold text-brand-blue">{getLensSourceLabel(lens.source)}</span>
													<span class="rounded-full bg-surface-container-high px-1.5 py-0.5 font-semibold text-on-surface-variant">{getLensTypeLabel(lens.type)}</span>
													{#if lens.material}<span>{lens.material.name}</span>{/if}
													{#if lens.supplier}<span>· {lens.supplier.name}</span>{/if}
												</div>
											{/if}
										</div>
									</div>

									<div class="grid gap-2 sm:grid-cols-3 xl:min-w-[22rem] xl:grid-cols-[5rem_7rem_6rem_auto] xl:items-end">
										<div>
											<Label for="qty-{item.id}" class="mb-1 text-[10px] font-semibold text-outline uppercase">Cant.</Label>
											{#if item.kind === 'product'}
												<Input id="qty-{item.id}" type="number" bind:value={item.quantity} min="1" max={availableStock !== null && availableStock > 0 ? availableStock : undefined} class="font-mono text-sm" />
											{:else if item.kind === 'free'}
												<Input id="qty-{item.id}" type="number" bind:value={item.quantity} min="1" class="font-mono text-sm" />
											{:else}
												<Input id="qty-{item.id}" type="number" value="1" disabled class="font-mono text-sm" />
											{/if}
											{#if item.kind === 'product' && availableStock !== null && item.quantity > availableStock}
												<p class="mt-0.5 text-[10px] text-red-600">Disp: {availableStock}</p>
											{/if}
										</div>
										<div>
											<Label for="price-{item.id}" class="mb-1 text-[10px] font-semibold text-outline uppercase">Precio</Label>
											<Input id="price-{item.id}" type="number" bind:value={item.unitPrice} step="0.01" min="0" class="font-mono text-sm" />
										</div>
										<div>
											<p class="mb-1 text-[10px] font-semibold text-outline uppercase">Total</p>
											<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
												<p class="font-mono text-sm font-semibold text-brand-navy tabular-nums">{formatPrice(step2ItemLineTotal(item))}</p>
											</div>
										</div>
										<div class="flex items-end justify-end">
											<button type="button" onclick={() => removeItem(item.id)} class="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-error-container/60 hover:text-red-700" title="Eliminar ítem">
												<Trash2 class="h-3.5 w-3.5" />
											</button>
										</div>
									</div>
								</div>

								{#if item.kind === 'free' && item.freeItem}
									<div class="space-y-3 rounded-lg bg-amber-50/60 p-3">
										<div class="grid gap-3 sm:grid-cols-2">
											<div>
												<Label class="mb-1 text-[10px] font-semibold text-outline uppercase">Categoría *</Label>
												<select bind:value={item.freeItem.category} class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none">
													{#each ALL_FREE_ITEM_CATEGORIES as cat (cat)}
														<option value={cat}>{getFreeItemCategoryLabel(cat)}</option>
													{/each}
												</select>
											</div>
											<div>
												<Label class="mb-1 text-[10px] font-semibold text-outline uppercase">Descripción *</Label>
												<Input bind:value={item.freeItem.description} placeholder="LC Novak -2.50 miel, hidrogel..." maxlength={500} />
											</div>
										</div>
										<div class="grid gap-3 sm:grid-cols-2">
											<div>
												<Label class="mb-1 text-[10px] font-semibold text-outline uppercase">Costo estimado</Label>
												<Input type="number" value={item.freeItem.unitCost ?? undefined} oninput={(event) => { if (event.currentTarget instanceof HTMLInputElement) { setFreeItemUnitCost(item, event.currentTarget.value); } }} placeholder="0.00" step="0.01" min="0" class="font-mono" />
											</div>
											<div>
												<Label class="mb-1 text-[10px] font-semibold text-outline uppercase">Notas ópticas</Label>
												<Input bind:value={item.freeItem.opticalNotes} placeholder="OD -2.50 sph, color miel..." maxlength={1000} />
											</div>
										</div>
									</div>
								{/if}

								{#if item.kind === 'lens' && item.lensPair?.catalogItemId}
									<div class="space-y-2 rounded-lg bg-surface-container-low p-3">
										<div class="flex flex-wrap items-center gap-3" use:autoAnimate>
											<span class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">Ojos</span>
											<label class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-brand-navy shadow-sm">
												<input type="checkbox" bind:checked={item.lensPair.od.enabled} onchange={() => recalcSuggestedPrice(item)} class="h-3.5 w-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue" />
												<span>OD</span>
											</label>
											<label class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-brand-navy shadow-sm">
												<input type="checkbox" bind:checked={item.lensPair.oi.enabled} onchange={() => recalcSuggestedPrice(item)} class="h-3.5 w-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue" />
												<span>OI</span>
											</label>
											{#if eyeCount == 0}<p class="text-[10px] font-medium text-red-600">Habilita al menos un ojo</p>{/if}
										</div>
										{#if rangeWarnings.length > 0}
											<div class="rounded-lg bg-warning-container/60 px-3 py-2 text-xs text-on-warning-container">
												{#each rangeWarnings as warning (warning)}<p>{warning}</p>{/each}
											</div>
										{/if}

										<!-- Prescription accordion -->
										<div class="rounded-lg bg-surface-container-lowest px-3 py-2 shadow-sm">
											<button
												type="button"
												onclick={() => { prescriptionOpenFor = prescriptionOpenFor === item.id ? null : item.id; }}
												class="flex w-full cursor-pointer items-center justify-between gap-2"
											>
												<div class="flex items-center gap-1.5">
													<Eye class="h-3.5 w-3.5 text-brand-blue" />
													<p class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">Fórmula</p>
												</div>
												<div class="flex items-center gap-1.5">
													{#if rxErrorsPerLens[item.id] && Object.keys(rxErrorsPerLens[item.id]).length > 0}
														<span class="rounded-full bg-error-container px-1.5 py-0.5 text-[9px] font-semibold text-on-error-container">Pendiente</span>
													{:else if item.lensPair.od.prescription.sphere != null || item.lensPair.oi.prescription.sphere != null}
														<span class="rounded-full bg-success-container px-1.5 py-0.5 text-[9px] font-semibold text-on-success-container">Completa</span>
													{/if}
													<ChevronRight class="h-3.5 w-3.5 text-on-surface-variant transition-transform {prescriptionOpenFor === item.id ? 'rotate-90' : ''}" />
												</div>
											</button>
											{#if prescriptionOpenFor === item.id}
												{@const rxErrs = rxErrorsPerLens[item.id] ?? {}}
												{@const id = item.id}
												<div class="mt-2 space-y-2.5 border-t border-outline-variant/30 pt-2">
													<div class="flex flex-wrap items-center gap-3">
														<div class="flex-1">
															<label for="rx-{id}-doctor" class="mb-0.5 block text-[10px] font-semibold text-outline uppercase">Médico</label>
															<input id="rx-{id}-doctor" type="text" bind:value={item.lensPair.doctorName} placeholder="Nombre del doctor" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.doctorName ? '!border-red-400' : ''}" />
															{#if rxErrs.doctorName}<p class="mt-0.5 text-[10px] text-red-500">{rxErrs.doctorName}</p>{/if}
														</div>
														<div>
															<label for="rx-{id}-lens-type" class="mb-0.5 block text-[10px] font-semibold text-outline uppercase">Tipo de lente</label>
															<select id="rx-{id}-lens-type" bind:value={item.lensPair.lensType} class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none">
																{#each ALL_LENS_TYPES as type (type)}
																	<option value={type}>{getLensTypeLabel(type)}</option>
																{/each}
															</select>
														</div>
														<button
															type="button"
															onclick={() => copyOdToOi(item.lensPair!)}
															class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
														>
															<Copy class="h-3 w-3" />
															OD → OI
														</button>
													</div>
													<div class="grid grid-cols-2 gap-2.5">
														<div class="rounded-lg border border-blue-200/60 bg-blue-50/50 p-2.5">
															<p class="mb-1.5 text-[10px] font-semibold text-blue-700">OD - Ojo Derecho</p>
															<div class="grid grid-cols-2 gap-1.5">
																<div>
																	<label for="rx-{id}-od-sphere" class="mb-0.5 block text-[9px] text-slate-500">Esfera</label>
																	<input id="rx-{id}-od-sphere" type="number" step="0.25" placeholder="-2.00" bind:value={item.lensPair.od.prescription.sphere} class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.odSphere ? '!border-red-400' : ''}" />
																	{#if rxErrs.odSphere}<p class="mt-0.5 text-[10px] text-red-500">{rxErrs.odSphere}</p>{/if}
																</div>
																<div>
																	<label for="rx-{id}-od-cylinder" class="mb-0.5 block text-[9px] text-slate-500">Cilindro</label>
																	<input id="rx-{id}-od-cylinder" type="number" step="0.25" min={-10} max={0} placeholder="-0.50" bind:value={item.lensPair.od.prescription.cylinder} class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.odCylinder ? '!border-red-400' : ''}" />
																	{#if rxErrs.odCylinder}<p class="mt-0.5 text-[10px] text-red-500">{rxErrs.odCylinder}</p>{/if}
																</div>
																<div>
																	<label for="rx-{id}-od-axis" class="mb-0.5 block text-[9px] text-slate-500">Eje</label>
																	<input id="rx-{id}-od-axis" type="number" step="1" min={0} max={180} placeholder="180" bind:value={item.lensPair.od.prescription.axis} class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.odAxis ? '!border-red-400' : ''}" />
																	{#if rxErrs.odAxis}<p class="mt-0.5 text-[10px] text-red-500">{rxErrs.odAxis}</p>{/if}
																</div>
																<div>
																	<label for="rx-{id}-od-addition" class="mb-0.5 block text-[9px] text-slate-500">Adición</label>
																	<input id="rx-{id}-od-addition" type="number" step="0.25" min={0} max={5} placeholder="+1.50" bind:value={item.lensPair.od.prescription.addition} class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.odAddition ? '!border-red-400' : ''}" />
																	{#if rxErrs.odAddition}<p class="mt-0.5 text-[10px] text-red-500">{rxErrs.odAddition}</p>{/if}
																</div>
															</div>
														</div>
														<div class="rounded-lg border border-violet-200/60 bg-violet-50/50 p-2.5">
															<p class="mb-1.5 text-[10px] font-semibold text-violet-700">OI - Ojo Izquierdo</p>
															<div class="grid grid-cols-2 gap-1.5">
																<div>
																	<label for="rx-{id}-oi-sphere" class="mb-0.5 block text-[9px] text-slate-500">Esfera</label>
																	<input id="rx-{id}-oi-sphere" type="number" step="0.25" placeholder="-2.00" bind:value={item.lensPair.oi.prescription.sphere} class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.oiSphere ? '!border-red-400' : ''}" />
																	{#if rxErrs.oiSphere}<p class="mt-0.5 text-[10px] text-red-500">{rxErrs.oiSphere}</p>{/if}
																</div>
																<div>
																	<label for="rx-{id}-oi-cylinder" class="mb-0.5 block text-[9px] text-slate-500">Cilindro</label>
																	<input id="rx-{id}-oi-cylinder" type="number" step="0.25" min={-10} max={0} placeholder="-0.50" bind:value={item.lensPair.oi.prescription.cylinder} class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.oiCylinder ? '!border-red-400' : ''}" />
																	{#if rxErrs.oiCylinder}<p class="mt-0.5 text-[10px] text-red-500">{rxErrs.oiCylinder}</p>{/if}
																</div>
																<div>
																	<label for="rx-{id}-oi-axis" class="mb-0.5 block text-[9px] text-slate-500">Eje</label>
																	<input id="rx-{id}-oi-axis" type="number" step="1" min={0} max={180} placeholder="180" bind:value={item.lensPair.oi.prescription.axis} class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.oiAxis ? '!border-red-400' : ''}" />
																	{#if rxErrs.oiAxis}<p class="mt-0.5 text-[10px] text-red-500">{rxErrs.oiAxis}</p>{/if}
																</div>
																<div>
																	<label for="rx-{id}-oi-addition" class="mb-0.5 block text-[9px] text-slate-500">Adición</label>
																	<input id="rx-{id}-oi-addition" type="number" step="0.25" min={0} max={5} placeholder="+1.50" bind:value={item.lensPair.oi.prescription.addition} class="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none {rxErrs.oiAddition ? '!border-red-400' : ''}" />
																	{#if rxErrs.oiAddition}<p class="mt-0.5 text-[10px] text-red-500">{rxErrs.oiAddition}</p>{/if}
																</div>
															</div>
														</div>
													</div>
												</div>
											{/if}
										</div>

										<div class="grid gap-2 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]" use:autoAnimate>
											{#if eyeCount > 0 && lens && item.costOverrides}
												{@const co = item.costOverrides}
												{@const effectiveShipping = item.shippingCostPending ? 0 : co.shippingPrice}
												{@const internalCostTotal = co.baseCost + co.mountingPrice + effectiveShipping}
												<div class="rounded-lg bg-surface-container-lowest px-3 py-2 shadow-sm" use:autoAnimate>
													<button type="button" onclick={() => { costOpenFor = costOpenFor === item.id ? null : item.id; }} class="flex w-full cursor-pointer items-center justify-between gap-2">
														<div class="text-start">
															<p class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">Costo interno</p>
														</div>
														<div class="flex items-center gap-1.5">
															<span class="font-mono text-xs font-semibold text-brand-navy">{formatPrice(internalCostTotal)}</span>
															{#if item.shippingCostPending}<span class="rounded-full bg-warning-container px-1.5 py-0.5 text-[9px] font-semibold text-on-warning-container">Pendiente</span>{/if}
															<ChevronRight class="h-3.5 w-3.5 text-on-surface-variant transition-transform {costOpenFor === item.id ? 'rotate-90' : ''}" />
														</div>
													</button>
													{#if costOpenFor === item.id}
														<div class="mt-2 space-y-1.5 border-t border-outline-variant/30 pt-2 text-xs text-on-surface-variant">
															<div class="flex items-center justify-between gap-2"><span>Cristales × {eyeCount}</span>
																<input type="number" bind:value={co.baseCost} step="0.01" min="0" class="w-24 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none" /></div>
															<div class="flex items-center justify-between gap-2"><span>Montaje</span>
																<input type="number" bind:value={co.mountingPrice} step="0.01" min="0" class="w-24 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none" /></div>
															<div class="flex items-center justify-between gap-2"><span>Envío</span>
																{#if item.shippingCostPending}<span class="text-xs text-on-surface-variant/50 italic">Pendiente</span>
																{:else}<input type="number" bind:value={co.shippingPrice} step="0.01" min="0" class="w-24 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none" />{/if}
															</div>
															<label class="flex cursor-pointer items-center gap-1.5 text-[11px]"><input type="checkbox" bind:checked={item.shippingCostPending} class="h-3 w-3 rounded border-slate-300" /> <span>Costo de envío pendiente</span></label>
															<div class="flex items-center justify-between gap-2 border-t border-outline-variant/30 pt-1.5 font-semibold text-brand-navy"><span>Total</span><span class="font-mono">{formatPrice(internalCostTotal)}</span></div>
														</div>
													{/if}
												</div>
											{/if}

											{#if availableTreatments.length > 0}
												<div class="rounded-lg bg-surface-container-lowest px-3 py-2 shadow-sm">
													<div class="mb-2 flex items-center justify-between gap-2" use:autoAnimate>
														<div class="flex items-center gap-1.5"><FlaskConical class="h-3.5 w-3.5 text-brand-blue" /><p class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">Tratamientos</p></div>
														{#if treatmentTotal > 0}<span class="font-mono text-xs font-semibold text-brand-navy">{formatPrice(treatmentTotal)}</span>{/if}
													</div>
													<div class="space-y-1.5" use:autoAnimate>
														{#each availableTreatments as treatment (treatment.id)}
															{@const selected = isTreatmentSelected(item, treatment.id)}
															{@const selectedTreatment = item.treatments.find((t) => t.supplierTreatmentId === treatment.id)}
															<div class="rounded-lg px-2.5 py-1.5 transition-colors {selected ? 'bg-surface-container-low' : 'bg-surface hover:bg-surface-container-low'}" use:autoAnimate>
																<label class="flex cursor-pointer items-center gap-2">
																	<input type="checkbox" checked={selected} onchange={() => toggleTreatment(item, treatment)} class="h-3.5 w-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue" />
																	<div class="min-w-0 flex-1">
																		<div class="flex flex-wrap items-center gap-1.5">
																			<span class="text-xs font-medium text-brand-navy">{treatment.name}</span>
																			<span class="rounded-full px-1 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase {treatment.category === TreatmentCategory.AR ? 'bg-brand-blue/10 text-brand-blue' : 'bg-surface-container-high text-on-surface-variant'}">{getTreatmentCategoryLabel(treatment.category)}</span>
																		</div>
																	</div>
																	<span class="font-mono text-xs font-semibold text-brand-navy">{formatPrice(selectedTreatment?.price ?? treatment.salePrice ?? treatment.price)}</span>
																</label>
																{#if selected && selectedTreatment}
																	<div class="mt-1.5 ml-5.5 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
																		<label class="inline-flex items-center gap-1.5"><span class="text-[11px]">Precio:</span><input type="number" bind:value={selectedTreatment.price} step="0.01" min="0" class="w-20 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none" /></label>
																		<span class="font-mono text-[11px]">× {eyeCount} = {formatPrice(selectedTreatment.price * eyeCount)}</span>
																	</div>
																{/if}
															</div>
														{/each}
													</div>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		{#if !valid}
			{@const reasons = getValidationReasons()}
			{#if reasons.length > 0}
				<div class="rounded-lg bg-warning-container/60 px-4 py-2.5 text-on-warning-container sm:px-5">
					<p class="text-[10px] font-semibold tracking-[0.14em] uppercase">Para continuar</p>
					<ul class="mt-1.5 space-y-0.5 text-xs">
						{#each reasons as reason, index (index)}<li>{reason}</li>{/each}
					</ul>
				</div>
			{/if}
		{/if}

		<SaleWizardFloatingActions
			showBack={true}
			{onCancel}
			primaryLabel="Continuar"
			primaryDisabled={!valid}
			primaryKind="next"
			summaryLabel="Total previo"
			summaryValue={formatPrice(partialTotal)}
			onBack={onprev}
			onPrimary={onnext}
		/>
	</div>

	<!-- ============================================================
	RIGHT COLUMN: Sticky Summary Sidebar
	============================================================ -->
	<div class="sticky top-24 w-64 shrink-0 space-y-4">
		<div class="rounded-xl bg-brand-navy px-4 py-4 text-white shadow-sm">
			<p class="text-[10px] font-semibold tracking-[0.14em] text-white/60 uppercase">Resumen parcial</p>
			<div class="mt-3 space-y-2.5 text-xs">
				<div class="flex items-center justify-between gap-2 text-white/70">
					<span>Ítems</span>
					<span class="font-mono font-semibold text-white tabular-nums">{selectedItemCount}</span>
				</div>
				<div class="flex items-center justify-between gap-2 text-white/70">
					<span>Productos y lentes</span>
					<span class="font-mono font-semibold text-white tabular-nums">{formatPrice(coreItemsSubtotal)}</span>
				</div>
				{#if selectedTreatmentCount > 0}
					<div class="flex items-center justify-between gap-2 text-white/70">
						<span>Tratamientos ({selectedTreatmentCount})</span>
						<span class="font-mono font-semibold text-white tabular-nums">{formatPrice(treatmentsSubtotal)}</span>
					</div>
				{/if}
				<div class="h-px bg-white/10"></div>
				<div class="flex items-end justify-between gap-2">
					<p class="text-[10px] font-semibold tracking-[0.14em] text-white/60 uppercase">Total previo</p>
					<p class="font-mono text-xl font-bold text-white tabular-nums">{formatPrice(partialTotal)}</p>
				</div>
			</div>
		</div>
	</div>
</div>


