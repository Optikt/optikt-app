<script lang="ts">
	import { untrack } from 'svelte';
	import { Input, Label } from 'flowbite-svelte';
	import {
		Trash2,
		ChevronRight,
		User,
		Hash,
		Eye,
		FlaskConical,
		Search,
		Package,
		X
	} from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';
	import { DiscountType, TreatmentCategory, LensCatalogSource } from '$lib/shared/enums';
	import {
		getLensTypeLabel,
		getLensSourceLabel,
		getTreatmentCategoryLabel
	} from '$lib/shared/enums/lensTypes';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { listSupplierTreatments } from '$lib/remote/suppliers.remote';
	import {
		findProduct,
		findLensItem,
		getAvailableProductStock,
		getRequiredEyes,
		step2ItemLineTotal,
		validatePrescriptionFields,
		hasPrescriptionErrors
	} from './saleItemHelpers';
	import type { PrescriptionFieldErrors } from './saleItemHelpers';
	import PrescriptionInput from './PrescriptionInput.svelte';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import type { Customer, Prescription } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';
	import { createEmptyLensPair } from './newSaleTypes';
	import SaleWizardFloatingActions from './SaleWizardFloatingActions.svelte';

	interface Props {
		items: SaleItemRow[];
		prescriptionValues: PrescriptionValues;
		customerPrescription: Prescription | null;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		nextOrderNumber?: number;
		valid: boolean;
		onnext: () => void;
		onprev: () => void;
	}

	let {
		items = $bindable(),
		prescriptionValues = $bindable(),
		customerPrescription,
		selectedCustomer,
		newCustomer,
		products,
		lensItems,
		nextOrderNumber,
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
		inventoryMode?: string;
		price: number;
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

	const quickAddPlaceholder = $derived.by(() => {
		if (quickAddFilter === 'product') return 'Buscar producto por nombre o código...';
		if (quickAddFilter === 'lens') return 'Buscar lente por nombre, material o tipo...';
		return 'Buscar productos, lentes... (+3.50 -2.00)';
	});

	const quickAddOptions = $derived.by((): QuickAddOption[] => {
		const selectedProductIds = new Set(
			items
				.filter((item) => item.kind === 'product' && item.productId !== '')
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
			productId: '',
			quantity: 1,
			lensPair: null,
			treatments: [],
			unitPrice: 0,
			discount: 0,
			discountType: DiscountType.FIXED,
			notes: ''
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
		syncPrescription(item);
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

	function selectQuickAddOption(option: QuickAddOption) {
		if (option.kind === 'product') {
			const alreadySelected = items.some(
				(item) => item.kind === 'product' && item.productId === option.id
			);
			if (alreadySelected) {
				resetQuickAdd();
				return;
			}
		}

		items = [...items, createItemFromQuickAdd(option)];
		resetQuickAdd();
	}

	function handleQuickAddKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeQuickAdd();
			return;
		}

		if (event.key === 'Enter' && visibleQuickAddOptions.length > 0) {
			event.preventDefault();
			selectQuickAddOption(visibleQuickAddOptions[0]);
		}
	}

	function removeItem(id: string) {
		items = items.filter((i) => i.id !== id);
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
		// FINISHED lenses come with coatings already applied — no treatments to add
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
					isTaxable: treatment.isTaxable,
					taxRate: treatment.taxRate
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

	function parseNumOrZero(v: string): number {
		return parseNullableNum(v) ?? 0;
	}

	function parseAddition(v: string): number | null {
		const n = parseNullableNum(v);
		// Addition of 0 means no addition in practice.
		if (n === null || n === 0) return null;
		return n;
	}

	function parseAxis(v: string, cylinder: number): number | null {
		// Axis is relevant only when cylinder is present.
		if (cylinder === 0) return null;
		return parseNullableNum(v);
	}

	/** Sync shared prescription form values into the lens pair */
	function syncPrescription(item: SaleItemRow) {
		if (item.kind !== 'lens' || !item.lensPair?.catalogItemId) return;

		const pair = item.lensPair;

		const odCylinder = parseNumOrZero(prescriptionValues.odCylinder);
		const oiCylinder = parseNumOrZero(prescriptionValues.oiCylinder);

		pair.od.prescription = {
			sphere: parseNumOrZero(prescriptionValues.odSphere),
			cylinder: odCylinder,
			axis: parseAxis(prescriptionValues.odAxis, odCylinder),
			addition: parseAddition(prescriptionValues.odAddition)
		};
		pair.oi.prescription = {
			sphere: parseNumOrZero(prescriptionValues.oiSphere),
			cylinder: oiCylinder,
			axis: parseAxis(prescriptionValues.oiAxis, oiCylinder),
			addition: parseAddition(prescriptionValues.oiAddition)
		};
	}

	// Re-evaluate all lens items when prescription changes
	$effect(() => {
		// Track only prescription value changes as dependencies
		void prescriptionValues.odSphere;
		void prescriptionValues.odCylinder;
		void prescriptionValues.odAxis;
		void prescriptionValues.odAddition;
		void prescriptionValues.oiSphere;
		void prescriptionValues.oiCylinder;
		void prescriptionValues.oiAxis;
		void prescriptionValues.oiAddition;
		void prescriptionValues.lensType;

		// Untrack items iteration + writes to avoid infinite re-trigger loop
		untrack(() => {
			for (const item of items) {
				if (item.kind === 'lens' && item.lensPair?.catalogItemId) {
					syncPrescription(item);
				}
			}
		});
	});

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

	const requiredEyes = $derived(getRequiredEyes(items));

	const rxErrors: PrescriptionFieldErrors = $derived(
		validatePrescriptionFields(prescriptionValues, requiredEyes.needsOd, requiredEyes.needsOi)
	);

	/** Only show Rx errors once the user has started filling in prescription fields */
	const anyRxFieldFilled = $derived(
		prescriptionValues.odSphere !== '' ||
			prescriptionValues.odCylinder !== '' ||
			prescriptionValues.odAxis !== '' ||
			prescriptionValues.odAddition !== '' ||
			prescriptionValues.oiSphere !== '' ||
			prescriptionValues.oiCylinder !== '' ||
			prescriptionValues.oiAxis !== '' ||
			prescriptionValues.oiAddition !== ''
	);

	const visibleRxErrors: PrescriptionFieldErrors = $derived(anyRxFieldFilled ? rxErrors : {});

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
			}
			if (item.kind === 'product' && item.productId) {
				const availableStock = getAvailableStockForProduct(item.productId, item.id);
				if (availableStock !== null && (availableStock <= 0 || item.quantity > availableStock)) {
					reasons.push(`Ítem #${num}: stock insuficiente (disponible: ${availableStock})`);
				}
			}
		}
		if (hasPrescriptionErrors(rxErrors)) {
			reasons.push('Complete los campos de prescripción requeridos');
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

	/** Sale price for the lens — salePrice is always per pair. Falls back to cost (base + mounting + shipping). */
	function lensSalePrice(lens: LensCatalogItemWithRelations, _eyeCount: number): number {
		if (lens.salePrice != null && lens.salePrice > 0) {
			return lens.salePrice;
		}
		// Fallback to cost-based price
		return lens.pairPurchasePrice + lens.mountingPrice + lens.shippingPrice;
	}

	/** Base lens cost — always the normalized pair cost */
	function lensBaseCost(lens: LensCatalogItemWithRelations, _eyeCount: number): number {
		return lens.pairPurchasePrice;
	}

	// ============================================================================
	// OPTICAL RANGE VALIDATION
	// ============================================================================

	/** Check if a value falls within [min, max]. Returns true if no range boundary defined. */
	function inRange(value: number | null, min: number | null, max: number | null): boolean {
		if (value === null || value === 0) return true; // no value to check
		if (min !== null && value < min) return false;
		if (max !== null && value > max) return false;
		return true;
	}

	/** Returns warning messages if the prescription doesn't fit any of the lens's optical ranges. */
	function getRangeWarnings(item: SaleItemRow): string[] {
		if (item.kind !== 'lens' || !item.lensPair?.catalogItemId) return [];
		if (!anyRxFieldFilled) return [];

		const lens = lensItems.find((l) => l.id === item.lensPair!.catalogItemId);
		if (!lens || lens.ranges.length === 0) return [];

		const warnings: string[] = [];
		const eyes: {
			label: string;
			enabled: boolean;
			sphere: string;
			cylinder: string;
			addition: string;
		}[] = [
			{
				label: 'OD',
				enabled: item.lensPair.od.enabled,
				sphere: prescriptionValues.odSphere,
				cylinder: prescriptionValues.odCylinder,
				addition: prescriptionValues.odAddition
			},
			{
				label: 'OI',
				enabled: item.lensPair.oi.enabled,
				sphere: prescriptionValues.oiSphere,
				cylinder: prescriptionValues.oiCylinder,
				addition: prescriptionValues.oiAddition
			}
		];

		for (const eye of eyes) {
			if (!eye.enabled) continue;
			const sphere = parseNullableNum(eye.sphere);
			const cylinder = parseNullableNum(eye.cylinder);
			const addition = parseNullableNum(eye.addition);

			// Check if prescription fits at least one range
			const fitsAny = lens.ranges.some(
				(r) =>
					inRange(sphere, r.sphereMin, r.sphereMax) &&
					inRange(cylinder, r.cylinderMin ?? null, r.cylinderMax ?? null) &&
					inRange(addition, r.additionMin ?? null, r.additionMax ?? null)
			);

			if (!fitsAny) {
				const parts: string[] = [];
				if (sphere !== null) parts.push(`Esf ${sphere >= 0 ? '+' : ''}${sphere.toFixed(2)}`);
				if (cylinder !== null) parts.push(`Cil ${cylinder >= 0 ? '+' : ''}${cylinder.toFixed(2)}`);
				if (addition !== null) parts.push(`Add ${addition >= 0 ? '+' : ''}${addition.toFixed(2)}`);
				warnings.push(`${eye.label} (${parts.join(', ')}) fuera del rango óptico del cristal`);
			}
		}

		return warnings;
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
		return 'Venta de mostrador';
	});

	const displayCustomerId = $derived.by(() => {
		if (newCustomer) return newCustomer.idNumber || 'Cliente nuevo sin documento';
		if (selectedCustomer) return selectedCustomer.idNumber;
		return 'Sin cliente asignado';
	});

	const contextStatus = $derived.by(() => {
		if (customerPrescription) return 'Fórmula previa disponible';
		if (newCustomer) return 'Cliente nuevo en esta venta';
		if (selectedCustomer) return 'Cliente asociado';
		if (selectedLensCount > 0) return 'Fórmula manual requerida';
		return 'Venta sin cliente';
	});
</script>

<div class="space-y-6 pb-28">
	<div class="grid grid-cols-6 gap-6">
		<!-- Cliente resumen -->
		<div class="col-span-4 rounded-[1.5rem] bg-brand-navy px-5 py-4 text-white shadow-sm">
			<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div class="flex flex-wrap items-center gap-5 sm:gap-6">
					<div>
						<p class="text-[11px] font-semibold tracking-[0.16em] text-white/60 uppercase">
							Orden #
						</p>
						<p class="font-mono text-2xl font-bold text-white tabular-nums">
							{nextOrderNumber ?? '—'}
						</p>
					</div>
					<div class="hidden h-10 w-px bg-white/10 sm:block"></div>
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white"
						>
							<User class="h-4 w-4" />
						</div>
						<div>
							<p class="text-[11px] font-semibold tracking-[0.16em] text-white/60 uppercase">
								Cliente
							</p>
							<p class="text-lg font-semibold text-white">{displayCustomerName}</p>
							<p class="mt-1 font-mono text-xs text-white/60">{displayCustomerId}</p>
						</div>
					</div>
				</div>

				<div
					class="inline-flex max-w-max items-center gap-1.5 self-start rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-white/75 uppercase"
				>
					{#if customerPrescription}
						<Eye class="h-3.5 w-3.5" />
					{:else}
						<Hash class="h-3.5 w-3.5" />
					{/if}
					<span>{contextStatus}</span>
				</div>
			</div>
		</div>

		<!-- Resumen parcial -->
		<div
			class="col-span-2 row-span-2 rounded-[1.5rem] bg-brand-navy px-5 py-5 text-white shadow-sm"
		>
			<p class="text-[11px] font-semibold tracking-[0.16em] text-white/60 uppercase">
				Resumen parcial
			</p>
			<div class="mt-4 space-y-3 text-sm">
				<div class="flex items-center justify-between gap-4 text-white/75">
					<span>Ítems seleccionados</span>
					<span class="font-mono font-semibold text-white tabular-nums">{selectedItemCount}</span>
				</div>
				<div class="flex items-center justify-between gap-4 text-white/75">
					<span>Productos y lentes</span>
					<span class="font-mono font-semibold text-white tabular-nums"
						>{formatPrice(coreItemsSubtotal)}</span
					>
				</div>
				{#if selectedTreatmentCount > 0}
					<div class="flex items-center justify-between gap-4 text-white/75">
						<span>Tratamientos ({selectedTreatmentCount})</span>
						<span class="font-mono font-semibold text-white tabular-nums"
							>{formatPrice(treatmentsSubtotal)}</span
						>
					</div>
				{/if}
				<div class="h-px bg-white/10"></div>
				<div class="flex items-end justify-between gap-4">
					<p class="text-[11px] font-semibold tracking-[0.16em] text-white/60 uppercase">
						Total previo al resumen
					</p>
					<p class="font-mono text-2xl font-bold text-white tabular-nums">
						{formatPrice(partialTotal)}
					</p>
				</div>
			</div>
		</div>

		<!-- Search bar -->
		<div class="col-span-4 rounded-[1.5rem] bg-surface-container-low px-4 py-4 sm:px-5">
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
						class="w-full rounded-lg border border-slate-200 bg-white py-2.5 pr-10 pl-10 text-sm text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
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
											onclick={() => selectQuickAddOption(option)}
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
											onclick={() => selectQuickAddOption(option)}
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
			</div>
		</div>
	</div>

	<div class="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_22rem]">
		<!-- Artitculos de la venta -->
		<div class="space-y-4">
			<div class="rounded-[1.5rem] bg-surface-container-low px-4 py-4 sm:px-5">
				<div class="mb-4 flex items-center justify-between gap-3">
					<div>
						<p class="text-[11px] font-semibold tracking-[0.16em] text-outline uppercase">Paso 2</p>
						<h3 class="text-lg font-semibold text-brand-navy">Artículos de la venta</h3>
					</div>
					<span
						class="rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-on-surface-variant"
					>
						{selectedItemCount}
						{selectedItemCount === 1 ? 'ítem' : 'ítems'}
					</span>
				</div>

				<div class="space-y-3">
					{#if items.length === 0}
						<div
							class="flex flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-outline-variant/40 bg-surface-container-lowest px-6 py-10 text-center"
						>
							<div
								class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue"
							>
								<Search class="h-5 w-5" />
							</div>
							<div class="mt-4 max-w-md space-y-2">
								<h4 class="text-base font-semibold text-brand-navy">
									Agrega el primer artículo desde la búsqueda
								</h4>
							</div>
						</div>
					{:else}
						{#each items as item, index (item.id)}
							{@const product = item.kind === 'product' ? getProduct(item) : undefined}
							{@const lens = item.kind === 'lens' ? getLensForDisplay(item) : undefined}
							{@const maxStock = item.kind === 'product' ? getProductMaxStock(item) : null}
							{@const availableStock =
								item.kind === 'product'
									? getAvailableStockForProduct(item.productId, item.id)
									: null}
							{@const rangeWarnings = item.kind === 'lens' ? getRangeWarnings(item) : []}
							{@const availableTreatments =
								item.kind === 'lens' ? getAvailableTreatments(item) : []}
							{@const eyeCount = item.kind === 'lens' ? getEnabledEyeCount(item) : 0}
							{@const treatmentTotal = item.kind === 'lens' ? getTreatmentTotal(item) : 0}

							<div class="rounded-[1.2rem] bg-surface-container-lowest p-4 shadow-sm">
								<div class="space-y-4">
									<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
										<div class="flex min-w-0 flex-1 items-start gap-3">
											<div
												class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl {item.kind ===
												'lens'
													? 'bg-brand-blue/15 text-brand-blue'
													: 'bg-surface-container-high text-brand-navy'}"
											>
												{#if item.kind === 'lens'}
													<Eye class="h-4 w-4" />
												{:else}
													<Package class="h-4 w-4" />
												{/if}
											</div>
											<div class="min-w-0">
												<div class="flex flex-wrap items-center gap-2">
													<p
														class="text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
													>
														Ítem {index + 1}
													</p>
													<span
														class="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase {item.kind ===
														'lens'
															? 'bg-brand-blue/10 text-brand-blue'
															: 'bg-surface-container-high text-on-surface-variant'}"
													>
														{item.kind === 'lens' ? 'Lente' : 'Producto'}
													</span>
													{#if item.kind === 'product' && maxStock !== null}
														<span
															class="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase {availableStock !==
																null && availableStock <= 3
																? 'bg-warning-container text-on-warning-container'
																: 'bg-success-container text-on-success-container'}"
														>
															{availableStock ?? maxStock} disponibles
														</span>
													{/if}
												</div>
												<h4 class="truncate text-base font-semibold text-brand-navy">
													{#if item.kind === 'product'}
														{product?.name ?? 'Producto por seleccionar'}
													{:else}
														{lens?.name ?? 'Lente por seleccionar'}
													{/if}
												</h4>
												{#if item.kind === 'product' && product}
													<p class="mt-1 text-xs text-on-surface-variant">
														{#if product.sku}
															<span class="font-mono">{product.sku}</span>
														{/if}
														{#if product.brand}
															<span>{product.sku ? ' · ' : ''}{product.brand.name}</span>
														{/if}
													</p>
												{:else if item.kind === 'lens' && lens}
													<div
														class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant"
													>
														<span
															class="rounded-full bg-brand-blue/10 px-2 py-0.5 font-semibold text-brand-blue"
															>{getLensSourceLabel(lens.source)}</span
														>
														<span
															class="rounded-full bg-surface-container-high px-2 py-0.5 font-semibold text-on-surface-variant"
															>{getLensTypeLabel(lens.type)}</span
														>
														{#if lens.material}
															<span>{lens.material.name}</span>
														{/if}
														{#if lens.supplier}
															<span>· {lens.supplier.name}</span>
														{/if}
													</div>
												{/if}
											</div>
										</div>

										<div
											class="grid gap-3 sm:grid-cols-3 xl:min-w-[25rem] xl:grid-cols-[6.5rem_8rem_8rem_auto] xl:items-end"
										>
											<div>
												<Label
													for="qty-{item.id}"
													class="mb-1.5 text-[11px] font-semibold text-outline uppercase"
												>
													Cantidad
												</Label>
												{#if item.kind === 'product'}
													<Input
														id="qty-{item.id}"
														type="number"
														bind:value={item.quantity}
														min="1"
														max={availableStock !== null && availableStock > 0
															? availableStock
															: undefined}
														class="font-mono"
													/>
												{:else}
													<Input
														id="qty-{item.id}"
														type="number"
														value="1"
														disabled
														class="font-mono"
													/>
												{/if}
												{#if item.kind === 'product' && availableStock !== null && item.quantity > availableStock}
													<p class="mt-1 text-xs text-red-600">Disponible: {availableStock}</p>
												{/if}
											</div>

											<div>
												<Label
													for="price-{item.id}"
													class="mb-1.5 text-[11px] font-semibold text-outline uppercase"
												>
													Precio unit.
												</Label>
												<Input
													id="price-{item.id}"
													type="number"
													bind:value={item.unitPrice}
													step="0.01"
													min="0"
													class="font-mono"
												/>
											</div>

											<div>
												<p class="mb-1.5 text-[11px] font-semibold text-outline uppercase">Total</p>
												<div class="rounded-xl bg-surface-container-low px-3 py-3">
													<p class="font-mono text-lg font-semibold text-brand-navy tabular-nums">
														{formatPrice(step2ItemLineTotal(item))}
													</p>
												</div>
											</div>

											<div class="flex items-end justify-end">
												<button
													type="button"
													onclick={() => removeItem(item.id)}
													class="rounded-xl p-2 text-red-500 transition-colors hover:bg-error-container/60 hover:text-red-700"
													title="Eliminar ítem"
												>
													<Trash2 class="h-4 w-4" />
												</button>
											</div>
										</div>
									</div>

									{#if item.kind === 'lens' && item.lensPair?.catalogItemId}
										<div class="space-y-3 rounded-[1rem] bg-surface-container-low px-4 py-4">
											<div
												class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
											>
												<div class="flex flex-wrap items-center gap-2">
													<span class="text-sm font-medium text-on-surface-variant"
														>Ojos habilitados</span
													>
													<label
														class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 py-1.5 text-sm font-semibold text-brand-navy shadow-sm"
													>
														<input
															type="checkbox"
															bind:checked={item.lensPair.od.enabled}
															onchange={() => {
																syncPrescription(item);
																recalcSuggestedPrice(item);
															}}
															class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
														/>
														<span>OD</span>
													</label>
													<label
														class="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-container-lowest px-3 py-1.5 text-sm font-semibold text-brand-navy shadow-sm"
													>
														<input
															type="checkbox"
															bind:checked={item.lensPair.oi.enabled}
															onchange={() => {
																syncPrescription(item);
																recalcSuggestedPrice(item);
															}}
															class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
														/>
														<span>OI</span>
													</label>
												</div>

												{#if eyeCount > 0}
													<p class="text-xs font-medium text-on-surface-variant">
														{eyeCount === 2
															? 'Par completo habilitado'
															: 'Configuración por un solo ojo'}
													</p>
												{:else}
													<p class="text-xs font-medium text-red-600">
														Debe habilitar al menos un ojo
													</p>
												{/if}
											</div>

											{#if rangeWarnings.length > 0}
												<div
													class="rounded-xl bg-warning-container/60 px-4 py-3 text-on-warning-container"
												>
													<p class="text-[11px] font-semibold tracking-[0.16em] uppercase">
														Fuera de rango óptico
													</p>
													<ul class="mt-2 space-y-1 text-sm">
														{#each rangeWarnings as warning (warning)}
															<li>{warning}</li>
														{/each}
													</ul>
												</div>
											{/if}

											<div class="grid gap-3 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
												{#if eyeCount > 0 && lens}
													{@const internalCostTotal =
														lensBaseCost(lens, eyeCount) + lens.mountingPrice + lens.shippingPrice}
													<details
														class="rounded-xl bg-surface-container-lowest px-4 py-3 shadow-sm"
													>
														<summary
															class="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"
														>
															<div>
																<p
																	class="text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
																>
																	Costo interno
																</p>
																<p class="mt-1 text-xs text-on-surface-variant">
																	Ver desglose de cristales, montaje y envío
																</p>
															</div>
															<div class="flex items-center gap-2">
																<span class="font-mono text-sm font-semibold text-brand-navy">
																	{formatPrice(internalCostTotal)}
																</span>
																<ChevronRight class="h-4 w-4 text-on-surface-variant" />
															</div>
														</summary>

														<div
															class="mt-3 space-y-2 border-t border-outline-variant/30 pt-3 text-sm text-on-surface-variant"
														>
															<div class="flex items-center justify-between gap-3">
																<span>
																	Cristales{lens.priceType === 'PAIR' ? ' (par)' : ` × ${eyeCount}`}
																</span>
																<span class="font-mono text-brand-navy">
																	{formatPrice(lensBaseCost(lens, eyeCount))}
																</span>
															</div>
															{#if lens.mountingPrice > 0}
																<div class="flex items-center justify-between gap-3">
																	<span>Montaje</span>
																	<span class="font-mono text-brand-navy"
																		>{formatPrice(lens.mountingPrice)}</span
																	>
																</div>
															{/if}
															{#if lens.shippingPrice > 0}
																<div class="flex items-center justify-between gap-3">
																	<span>Envío</span>
																	<span class="font-mono text-brand-navy"
																		>{formatPrice(lens.shippingPrice)}</span
																	>
																</div>
															{/if}
															<div
																class="flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-2 font-semibold text-brand-navy"
															>
																<span>Total</span>
																<span class="font-mono">{formatPrice(internalCostTotal)}</span>
															</div>
														</div>
													</details>
												{/if}

												{#if availableTreatments.length > 0}
													<div class="rounded-xl bg-surface-container-lowest px-4 py-3 shadow-sm">
														<div class="mb-3 flex items-center justify-between gap-3">
															<div class="flex items-center gap-2">
																<FlaskConical class="h-4 w-4 text-brand-blue" />
																<p
																	class="text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
																>
																	Tratamientos
																</p>
															</div>
															{#if treatmentTotal > 0}
																<span class="font-mono text-sm font-semibold text-brand-navy"
																	>{formatPrice(treatmentTotal)}</span
																>
															{/if}
														</div>

														<div class="space-y-2">
															{#each availableTreatments as treatment (treatment.id)}
																{@const selected = isTreatmentSelected(item, treatment.id)}
																{@const selectedTreatment = item.treatments.find(
																	(t) => t.supplierTreatmentId === treatment.id
																)}
																<div
																	class="rounded-xl px-3 py-2 transition-colors {selected
																		? 'bg-surface-container-low'
																		: 'bg-surface hover:bg-surface-container-low'}"
																>
																	<label class="flex cursor-pointer items-center gap-3">
																		<input
																			type="checkbox"
																			checked={selected}
																			onchange={() => toggleTreatment(item, treatment)}
																			class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
																		/>
																		<div class="min-w-0 flex-1">
																			<div class="flex flex-wrap items-center gap-2">
																				<span class="font-medium text-brand-navy"
																					>{treatment.name}</span
																				>
																				<span
																					class="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase {treatment.category ===
																					TreatmentCategory.AR
																						? 'bg-brand-blue/10 text-brand-blue'
																						: 'bg-surface-container-high text-on-surface-variant'}"
																				>
																					{getTreatmentCategoryLabel(treatment.category)}
																				</span>
																			</div>
																			{#if selectedTreatment}
																				<p class="mt-1 text-xs text-on-surface-variant">
																					Multiplica por {eyeCount}
																					{eyeCount === 1 ? 'ojo' : 'ojos'}
																				</p>
																			{/if}
																		</div>
																		<span class="font-mono text-sm font-semibold text-brand-navy"
																			>{formatPrice(
																				selectedTreatment?.price ??
																					treatment.salePrice ??
																					treatment.price
																			)}</span
																		>
																	</label>

																	{#if selected && selectedTreatment}
																		<div
																			class="mt-2 ml-7 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant"
																		>
																			<label class="inline-flex items-center gap-2">
																				<span>Precio:</span>
																				<input
																					type="number"
																					bind:value={selectedTreatment.price}
																					step="0.01"
																					min="0"
																					class="w-24 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-right font-mono text-sm text-brand-navy focus:border-brand-blue focus:outline-none"
																				/>
																			</label>
																			<span class="font-mono"
																				>× {eyeCount} = {formatPrice(
																					selectedTreatment.price * eyeCount
																				)}</span
																			>
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
		</div>

		<!-- Fórmula compartida -->
		<div class="space-y-4">
			{#if hasLensItem}
				<div
					class="rounded-[1.6rem] border border-[#dbe6f8] bg-[linear-gradient(180deg,#f7faff_0%,#eff4fb_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:px-5"
				>
					<div class="mb-4 flex items-center gap-3">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-brand-blue shadow-sm"
						>
							<Eye class="h-4 w-4" />
						</div>
						<div>
							<p class="text-[11px] font-semibold tracking-[0.16em] text-outline uppercase">
								Fórmula compartida
							</p>
							<h4 class="text-base font-semibold text-brand-navy">
								Parámetros ópticos de la venta
							</h4>
						</div>
					</div>

					<div class="rounded-[1.25rem] bg-white/92 px-3.5 py-3.5 shadow-sm ring-1 ring-white/80">
						<PrescriptionInput
							bind:values={prescriptionValues}
							existingPrescription={customerPrescription}
							showAddition={prescriptionValues.lensType !== 'MONOFOCAL'}
							compact={true}
							errors={visibleRxErrors}
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#if !valid}
		{@const reasons = getValidationReasons()}
		{#if reasons.length > 0}
			<div
				class="rounded-[1.25rem] bg-warning-container/60 px-4 py-3 text-on-warning-container sm:px-5"
			>
				<p class="text-[11px] font-semibold tracking-[0.16em] uppercase">Para continuar</p>
				<ul class="mt-2 space-y-1 text-sm">
					{#each reasons as reason, index (index)}
						<li>{reason}</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}

	<SaleWizardFloatingActions
		showBack={true}
		primaryLabel="Continuar"
		primaryDisabled={!valid}
		primaryKind="next"
		summaryLabel="Total previo"
		summaryValue={formatPrice(partialTotal)}
		onBack={onprev}
		onPrimary={onnext}
	/>
</div>
