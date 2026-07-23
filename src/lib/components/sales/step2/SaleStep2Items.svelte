<script lang="ts">
	import { untrack, getContext } from 'svelte';
	import { CATALOG_KEY, type CatalogData } from '../wizardContext';
	import { toast } from 'svelte-sonner';
	import { Search } from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import { getAccessoriesForProduct } from '$lib/remote/brandAccessories.remote';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { LensCatalogSource } from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { listSupplierTreatments } from '$lib/remote/suppliers.remote';
	import {
		getAvailableProductStock,
		step2ItemLineTotal,
		validateLensPrescription,
		hasLensPrescriptionErrors,
		getEnabledEyeCount
	} from '../saleItemHelpers';
	import type { PrescriptionFieldErrors } from '../saleItemHelpers';
	import type { Customer, Prescription } from '$lib/server/db/schema';
	import type {
		SaleItemRow,
		NewCustomerData,
		LensSaleItemRow,
		TreatmentSaleItemRow
	} from '../newSaleTypes';
	import {
		createEmptyProductItem,
		createEmptyLensItem,
		createEmptyFreeItem,
		createEmptyTreatmentItem
	} from '../newSaleTypes';
	import {
		allowsDuplicateProductLines,
		canAutoIncludeAccessories,
		linkIncludedAccessories,
		removeItemWithIncludedAccessories,
		type IncludedAccessoryMap
	} from '../includedAccessories';
	import SaleWizardFloatingActions from '../SaleWizardFloatingActions.svelte';
	import SaleStep2ItemCard from './SaleStep2ItemCard.svelte';
	import SaleCustomerBanner from '../SaleCustomerBanner.svelte';
	import SaleStep2Toolbar from './SaleStep2Toolbar.svelte';
	import SaleStep2SearchBar from './SaleStep2SearchBar.svelte';
	import SaleTreatmentSlideOver from './SaleTreatmentSlideOver.svelte';

	interface Props {
		items: SaleItemRow[];
		includedAccessoryMap: IncludedAccessoryMap;
		customerPrescription: Prescription | null;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
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

	const { products, lensItems } = getContext<CatalogData>(CATALOG_KEY);

	// ============================================================================
	// ITEMS MANAGEMENT
	// ============================================================================

	function createIncludedAccessoryItem(
		parentItemId: string,
		accessoryRule: {
			accessoryProductId: string;
			priceMode: string;
			customPrice: number | null;
			currentProductPrice: number | null;
			accessory: { id: string; name: string; stock: number };
		}
	): SaleItemRow {
		const price = (() => {
			switch (accessoryRule.priceMode) {
				case 'PRODUCT':
					return accessoryRule.currentProductPrice ?? 0;
				case 'CUSTOM':
					return accessoryRule.customPrice ?? 0;
				default:
					return 0;
			}
		})();
		return {
			...createEmptyProductItem(accessoryRule.accessoryProductId),
			unitPrice: price,
			isIncludedAccessory: true,
			includedAccessoryParentItemId: parentItemId
		} as SaleItemRow;
	}

	function getAvailableStockForProduct(productId: string, excludeItemId?: string): number | null {
		return getAvailableProductStock(items, products, productId, excludeItemId);
	}

	function createItemFromQuickAdd(option: {
		kind: 'product' | 'lens';
		id: string;
		price: number;
		brandId?: string | null;
		productType?: string;
	}): SaleItemRow {
		if (option.kind === 'product') {
			const item = createEmptyProductItem(option.id);
			item.unitPrice = option.price;
			return item;
		}

		const item = createEmptyLensItem();
		item.lensPair.catalogItemId = option.id;
		item.productId = option.id;

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

	async function addIncludedAccessoriesForItem(
		option: { kind: string; brandId?: string | null; productType?: string; id: string },
		parentItem: SaleItemRow
	) {
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
			});

			if (!items.some((item) => item.id === parentItem.id)) {
				return;
			}

			const addedNames: string[] = [];
			const linkedIds: string[] = [];
			const accessoryItems: SaleItemRow[] = [];

			for (const accessoryRule of accessories as unknown as Array<{
				accessoryProductId: string;
				priceMode: string;
				customPrice: number | null;
				currentProductPrice: number | null;
				accessory: { id: string; name: string; stock: number };
			}>) {
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

	async function selectQuickAddOption(option: {
		kind: 'product' | 'lens';
		id: string;
		price: number;
		brandId?: string | null;
		productType?: string;
	}) {
		if (option.kind === 'product' && !allowsDuplicateProductLines(option.productType)) {
			const alreadySelected = items.some(
				(item) => item.kind === 'product' && item.productId === option.id
			);
			if (alreadySelected) {
				return;
			}
		}

		const nextItem = createItemFromQuickAdd(option);
		items = [...items, nextItem];

		await addIncludedAccessoriesForItem(option, nextItem);
	}

	function removeItem(id: string) {
		const nextState = removeItemWithIncludedAccessories(items, includedAccessoryMap, id);
		items = nextState.items;
		includedAccessoryMap = nextState.includedAccessoryMap;
		const childIds = items
			.filter(
				(item): item is TreatmentSaleItemRow =>
					item.kind === 'treatment' && item.parentLensItemId === id
			)
			.map((item) => item.id);
		if (childIds.length > 0) {
			items = items.filter((item) => !childIds.includes(item.id));
		}
	}

	function addFreeItem() {
		const item = createEmptyFreeItem();
		items = [...items, item];
	}

	// ============================================================================
	// TREATMENTS
	// ============================================================================

	type QuickAddFilter = 'all' | 'product' | 'lens';

	let quickAddFilter = $state<QuickAddFilter>('all');

	let treatmentCache = $state<Record<string, SupplierTreatment[]>>({});

	async function loadTreatmentsForSupplier(supplierId: string): Promise<SupplierTreatment[]> {
		if (treatmentCache[supplierId]) return treatmentCache[supplierId];
		const treatments = await listSupplierTreatments({ supplierId });
		treatmentCache[supplierId] = treatments.filter((t) => t.isActive);
		return treatmentCache[supplierId];
	}

	$effect(() => {
		const lensItemsInCart = items.filter((i): i is LensSaleItemRow => i.kind === 'lens');
		untrack(() => {
			for (const item of lensItemsInCart) {
				const lens = lensItems.find((l) => l.id === item.lensPair.catalogItemId);
				if (lens?.supplier?.id && lens.source !== LensCatalogSource.FINISHED) {
					loadTreatmentsForSupplier(lens.supplier.id);
				}
			}
		});
	});

	const itemTreatmentsMap = $derived.by(() => {
		const map: Record<string, SupplierTreatment[]> = {};
		for (const item of items) {
			if (item.kind !== 'lens') continue;
			const lens = lensItems.find((l) => l.id === item.lensPair.catalogItemId);
			if (lens?.supplier?.id && treatmentCache[lens.supplier.id]) {
				map[item.id] = treatmentCache[lens.supplier.id];
			}
		}
		return map;
	});

	const lensTreatmentInfo = $derived.by(() => {
		const map: Record<string, { name: string; total: number } | null> = {};
		for (const item of items) {
			if (item.kind !== 'lens') continue;
			const tItem = items.find(
				(i): i is TreatmentSaleItemRow => i.kind === 'treatment' && i.parentLensItemId === item.id
			);
			map[item.id] = tItem
				? { name: tItem.treatmentName, total: tItem.unitPrice * tItem.quantity }
				: null;
		}
		return map;
	});

	let activeTreatmentLensId = $state<string | null>(null);

	const activeTreatmentAvail = $derived(
		activeTreatmentLensId ? (itemTreatmentsMap[activeTreatmentLensId] ?? []) : []
	);

	const activeTreatmentItem = $derived(
		activeTreatmentLensId
			? (items.find(
					(item): item is TreatmentSaleItemRow =>
						item.kind === 'treatment' && item.parentLensItemId === activeTreatmentLensId
				) ?? null)
			: null
	);

	function handleOpenTreatmentSelector(lensItemId: string) {
		activeTreatmentLensId = lensItemId;
	}

	function handleCloseTreatmentSelector() {
		activeTreatmentLensId = null;
	}

	function handleSelectTreatment(treatment: SupplierTreatment | null) {
		if (!activeTreatmentLensId) return;
		const lensItem = items.find((i) => i.id === activeTreatmentLensId);
		if (!lensItem || lensItem.kind !== 'lens') return;
		const lens = lensItems.find((l) => l.id === lensItem.lensPair.catalogItemId);
		const brand = lens?.supplier?.name ?? '';

		if (treatment) {
			const existing = items.findIndex(
				(i): i is TreatmentSaleItemRow =>
					i.kind === 'treatment' && i.parentLensItemId === activeTreatmentLensId
			);
			const eyeCount = getEnabledEyeCount(lensItem);
			const newItem = createEmptyTreatmentItem(activeTreatmentLensId, treatment, brand, eyeCount);
			if (existing >= 0) {
				items = [...items.slice(0, existing), newItem, ...items.slice(existing + 1)];
			} else {
				const lensIdx = items.findIndex((i) => i.id === activeTreatmentLensId);
				items = [...items.slice(0, lensIdx + 1), newItem, ...items.slice(lensIdx + 1)];
			}
		} else {
			items = items.filter(
				(i) => !(i.kind === 'treatment' && i.parentLensItemId === activeTreatmentLensId)
			);
		}
		activeTreatmentLensId = null;
	}

	function handleRemoveTreatment(treatmentItemId: string) {
		items = items.filter((i) => i.id !== treatmentItemId);
	}

	// ============================================================================
	// PRESCRIPTION VALIDATION
	// ============================================================================

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

	/** Recalculate unitPrice to the suggested sale price for the lens only (excluding treatments).
	 *  Uses salePrice (sell price) when available, otherwise falls back to basePrice (cost). */
	function recalcSuggestedPrice(item: SaleItemRow) {
		if (item.kind !== 'lens') return;
		const lens = lensItems.find((l) => l.id === item.lensPair.catalogItemId);
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

	const selectedItemCount = $derived(items.length);

	const selectedLensCount = $derived(
		items.filter((item) => item.kind === 'lens' && (item.lensPair?.catalogItemId ?? '') !== '')
			.length
	);

	const partialTotal = $derived(items.reduce((sum, item) => sum + step2ItemLineTotal(item), 0));

	const displayCustomerName = $derived.by(() => {
		if (newCustomer) return `${newCustomer.firstName} ${newCustomer.lastName}`.trim();
		if (selectedCustomer)
			return `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim();
		return customerFallbackName;
	});

	const displayCustomerId = $derived.by(() => {
		if (newCustomer) return newCustomer.idNumber || 'Cliente nuevo sin documento';
		if (selectedCustomer) return selectedCustomer.idNumber || 'Sin documento';
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
		const firstLens = items.find((i): i is LensSaleItemRow => i.kind === 'lens');
		if (!firstLens) return;
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

<div class="min-w-0 flex-1 space-y-1">
	<div class="inline-flex w-full justify-between gap-1">
		<!-- Compact customer banner -->
		<SaleCustomerBanner
			name={displayCustomerName}
			document={displayCustomerId}
			statusLabel={contextStatus}
		/>

		<SaleStep2Toolbar
			filter={quickAddFilter}
			onfilterchange={(f) => (quickAddFilter = f)}
			{canCopyRxToAll}
			oncopyrx={copyFirstRxToAll}
			onaddfree={addFreeItem}
		/>
	</div>

	<div class="flex flex-wrap gap-4">
		<SaleStep2SearchBar
			filter={quickAddFilter}
			{items}
			onselect={(option) => selectQuickAddOption(option)}
		/>

		<div class="flex items-center gap-4 px-2">
			<h3 class="text-sm font-semibold text-brand-navy">{itemsSectionTitle}</h3>
			<span
				class="rounded-full border bg-surface-container-lowest px-2 py-0.5 text-[14px] font-semibold uppercase"
			>
				{selectedItemCount}
				{selectedItemCount === 1 ? 'item' : 'items'}
			</span>
		</div>
	</div>
	<!-- Items list -->
	<div>
		<div class="space-y-1" use:autoAnimate>
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
					{#if item.kind === 'treatment'}
						<div class="border-l-2 border-slate-200 pl-3 ml-4">
							<SaleStep2ItemCard
								{item}
								onremove={() => handleRemoveTreatment(item.id)}
								eyeCount={0}
								isIncludedAccessory={false}
								availableTreatments={[]}
								currentTreatmentName={item.treatmentName}
								onopenTreatment={itemTreatmentsMap[item.parentLensItemId]?.length > 0
									? () => handleOpenTreatmentSelector(item.parentLensItemId)
									: undefined}
							/>
						</div>
					{:else}
						{@const ti = item.kind === 'lens' ? (lensTreatmentInfo[item.id] ?? null) : null}
						<SaleStep2ItemCard
							{item}
							rxErrs={item.kind === 'lens' ? (rxErrorsPerLens[item.id] ?? {}) : {}}
							onremove={() => removeItem(item.id)}
							eyeCount={item.kind === 'lens' ? getEnabledEyeCount(item) : 0}
							isIncludedAccessory={item.isIncludedAccessory}
							availableTreatments={itemTreatmentsMap[item.id] ?? []}
							currentTreatmentName={ti?.name ?? null}
							onopenTreatment={item.kind === 'lens' && itemTreatmentsMap[item.id]?.length > 0
								? () => handleOpenTreatmentSelector(item.id)
								: undefined}
						/>
					{/if}
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

<SaleTreatmentSlideOver
	open={activeTreatmentLensId !== null}
	onclose={handleCloseTreatmentSelector}
	availableTreatments={activeTreatmentAvail}
	currentTreatmentId={activeTreatmentItem?.supplierTreatmentId ?? null}
	onselect={handleSelectTreatment}
/>
