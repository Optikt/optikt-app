<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Eye, Search, Package, X, Copy, PackagePlus } from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import { getAccessoriesForProduct } from '$lib/remote/brandAccessories.remote';
	import { BrandAccessoryPriceMode } from '$lib/shared/enums/brandAccessoryPriceModes';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { DiscountType, LensCatalogSource } from '$lib/shared/enums';
	import { getLensTypeLabel, getLensSourceLabel } from '$lib/shared/enums/lensTypes';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { listSupplierTreatments } from '$lib/remote/suppliers.remote';
	import {
		getAvailableProductStock,
		getLensRangeWarningsForItem,
		buildStep2PrescriptionConfirmation,
		step2ItemLineTotal,
		validateLensPrescription,
		hasLensPrescriptionErrors
	} from '../saleItemHelpers';
	import type { PrescriptionFieldErrors } from '../saleItemHelpers';
	import type { Customer, Prescription } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from '../newSaleTypes';
	import { createEmptyLensPair, createEmptyFreeItemData } from '../newSaleTypes';
	import {
		allowsDuplicateProductLines,
		canAutoIncludeAccessories,
		linkIncludedAccessories,
		removeItemWithIncludedAccessories,
		type IncludedAccessoryMap
	} from '../includedAccessories';
	import SaleWizardFloatingActions from '../SaleWizardFloatingActions.svelte';
	import SaleStep2ItemCard from './SaleStep2ItemCard.svelte';

	interface Props {
		items: SaleItemRow[];
		includedAccessoryMap: IncludedAccessoryMap;
		customerPrescription: Prescription | null;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
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
		customerFallbackName = 'Venta de mostrador',
		customerFallbackDocument = 'Sin cliente asignado',
		newCustomerContextLabel = 'Cliente nuevo en esta venta',
		selectedCustomerContextLabel = 'Cliente asociado',
		noCustomerContextLabel = 'Venta sin cliente',
		itemsSectionTitle = 'Artículos',
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
	const activeFilterIdx = $derived(
		quickAddFilterOptions.findIndex((o) => o.value === quickAddFilter)
	);

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

	// Load treatments when a lens item's supplier changes
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

	// ============================================================================
	// PRESCRIPTION VALIDATION
	// ============================================================================

	// ============================================================================
	// HELPERS
	// ============================================================================

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
		const hasRx =
			pair.od.prescription.sphere != null ||
			pair.od.prescription.cylinder != null ||
			pair.oi.prescription.sphere != null ||
			pair.oi.prescription.cylinder != null;
		if (!hasRx) return [];
		return getLensRangeWarningsForItem(item.id, step2PrescriptionConfirmation);
	}

	const selectedItemCount = $derived(items.length);

	const selectedLensCount = $derived(
		items.filter((item) => item.kind === 'lens' && (item.lensPair?.catalogItemId ?? '') !== '')
			.length
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
			items.some(
				(i) =>
					i.kind === 'lens' &&
					i.lensPair &&
					(i.lensPair.od.prescription.sphere != null || i.lensPair.oi.prescription.sphere != null)
			)
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
			dest.od.dp = src.od.dp;
			dest.od.np = src.od.np;
			dest.oi.dp = src.oi.dp;
			dest.oi.np = src.oi.np;
			dest.lensType = src.lensType;
			dest.doctorName = src.doctorName;
		}
	}

	function copyOiToOd(pair: import('../newSaleTypes').LensPairEntry) {
		pair.od.prescription = { ...pair.oi.prescription };
		pair.od.dp = pair.oi.dp;
		pair.od.np = pair.oi.np;
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

<div class="min-w-0 flex-1 space-y-2">
	<div class="inline-flex w-full justify-between gap-1">
		<!-- Compact customer banner -->
		<div
			class="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-brand-navy px-4 py-2.5 text-white shadow-sm"
		>
			<div class="flex flex-wrap items-center gap-2 text-xs font-semibold">
				<span class="max-w-[12rem] truncate">{displayCustomerName}</span>
				<span class="font-mono text-[12px] text-white/80">{displayCustomerId}</span>
			</div>
			<p
				class="rounded-full border-2 px-2 text-[10px] font-bold tracking-[0.14em] text-white/80 uppercase"
			>
				{contextStatus}
			</p>
		</div>

		<!-- Change product type search -->
		<div class="inline-flex items-center gap-1">
			<div
				class="relative inline-grid overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
				style="grid-template-columns: repeat({quickAddFilterOptions.length}, 1fr)"
			>
				<div
					class="absolute top-1 bottom-1 left-1 rounded-md bg-brand-navy shadow-sm transition-transform duration-200 ease-out"
					style="width: calc((100% - 0.5rem) / {quickAddFilterOptions.length}); transform: translateX(calc({activeFilterIdx} * 100%))"
				></div>
				{#each quickAddFilterOptions as option (option.value)}
					<button
						type="button"
						onclick={() => setQuickAddFilter(option.value)}
						class="relative z-10 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200 {quickAddFilter ===
						option.value
							? 'text-white'
							: 'text-slate-600 hover:text-slate-800'}"
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
				<PackagePlus class="h-3.5 w-3.5" />
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

	<!-- Search bar -->
	<!-- TODO: Use the Search bar component -->
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
			class="w-full rounded-lg border border-slate-200 bg-white px-8 py-2.5 text-sm text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
		/>
		{#if quickAddQuery}
			<button
				title="Limpiar búsqueda"
				type="button"
				onclick={resetQuickAdd}
				class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
			>
				<X class="h-3.5 w-3.5" />
			</button>
		{/if}

		{#if quickAddOpen}
			<!-- TODO: We should have some component for this since we have a global search bar too. We could have a simplified
			 and complex one, so we can use moe specific things here -->
			<div
				class="wmax absolute top-full right-0 left-0 z-30 mt-1.5 max-h-[420px] max-w-full min-w-[600px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60"
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
									<p class="truncate text-sm font-medium text-slate-800" title={option.name}>
										{option.name}
									</p>
									<p class="truncate text-xs text-slate-500" title={option.secondaryText}>
										{option.secondaryText}
									</p>
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
									<p class="truncate text-sm font-medium text-slate-800" title={option.name}>
										{option.name}
									</p>
									<p class="truncate text-xs text-slate-500" title={option.secondaryText}>
										{option.secondaryText}
									</p>
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

	<!-- Items list -->
	<div class="py-2">
		<div class="mb-2 flex items-center gap-4">
			<h3 class="text-sm font-semibold text-brand-navy">{itemsSectionTitle}</h3>
			<span
				class="rounded-full border bg-surface-container-lowest px-2 py-0.5 text-[14px] font-semibold uppercase"
			>
				{selectedItemCount}
				{selectedItemCount === 1 ? 'item' : 'items'}
			</span>
		</div>

		<div class="space-y-2" use:autoAnimate>
			{#if items.length === 0}
				<div
					class="flex flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-lowest px-4 py-8 text-center"
				>
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue"
					>
						<Search class="h-4 w-4" />
					</div>
					<h4 class="mt-3 text-sm font-semibold text-brand-navy">
						Agrega el primer artículo desde la búsqueda
					</h4>
				</div>
			{:else}
				{#each items as item, _index (item.id)}
					<SaleStep2ItemCard
						{item}
						{products}
						{lensItems}
						availableTreatments={item.kind === 'lens' ? getAvailableTreatments(item) : []}
						rxErrs={rxErrorsPerLens[item.id] ?? {}}
						onremove={() => removeItem(item.id)}
						ontoggletreatment={(treatment) => toggleTreatment(item, treatment)}
						onrecalcprice={() => recalcSuggestedPrice(item)}
						oncopyoi={() => copyOiToOd(item.lensPair!)}
						lensRangeWarnings={item.kind === 'lens' ? getRangeWarnings(item) : []}
						eyeCount={item.kind === 'lens' ? getEnabledEyeCount(item) : 0}
						treatmentTotal={item.kind === 'lens' ? getTreatmentTotal(item) : 0}
						isIncludedAccessory={item.isIncludedAccessory}
					/>
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
