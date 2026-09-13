<script lang="ts">
	import { untrack, getContext } from 'svelte';
	import { CATALOG_KEY, type CatalogData } from '../wizardContext';
	import { toast } from 'svelte-sonner';
	import { getAccessoriesForProduct } from '$lib/remote/brandAccessories.remote';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { LensCatalogSource } from '$lib/shared/enums';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { listSupplierTreatments } from '$lib/remote/suppliers.remote';
	import {
		getAvailableProductStock,
		step2ItemLineTotal,
		validateLensPrescription,
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
	import SaleCustomerBanner from '../SaleCustomerBanner.svelte';
	import SaleStep2Toolbar from './SaleStep2Toolbar.svelte';
	import SaleStep2SearchBar from './SaleStep2SearchBar.svelte';
	import SaleTreatmentSlideOver from './SaleTreatmentSlideOver.svelte';
	import Step2ItemsList from './items/Step2ItemsList.svelte';
	import Step2ValidationHints from './items/Step2ValidationHints.svelte';
	import {
		createIncludedAccessoryItem,
		type IncludedAccessoryRule
	} from './items/step2Accessories';
	import { recalcSuggestedPrice } from './items/step2Pricing';
	import { copyFirstRxToAll } from './items/step2RxCopy';
	import { getValidationReasons } from './items/step2Validation';

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

	const catalog = getContext<CatalogData>(CATALOG_KEY);

	function findLensById(id: string) {
		return catalog.getLensItems().find((l) => l.id === id);
	}

	function getAvailableStockForProduct(productId: string, excludeItemId?: string): number | null {
		return getAvailableProductStock(items, catalog.getProducts(), productId, excludeItemId);
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

		const lens = findLensById(option.id);
		if (lens) {
			item.costOverrides = {
				baseCost: lens.pairPurchasePrice,
				mountingPrice: lens.mountingPrice,
				shippingPrice: lens.shippingPrice
			};
			item.lensPair.lensType = lens.type;
		}

		recalcSuggestedPrice(item, findLensById);
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

			for (const accessoryRule of accessories as unknown as IncludedAccessoryRule[]) {
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

	type QuickAddFilter = 'all' | 'product' | 'lens';

	let quickAddFilter = $state<QuickAddFilter>('all');

	let treatmentCache = $state<Record<string, SupplierTreatment[]>>({});

	async function loadTreatmentsForSupplier(supplierId: string): Promise<SupplierTreatment[]> {
		if (treatmentCache[supplierId]) return treatmentCache[supplierId];
		const treatments = await listSupplierTreatments({ supplierId });
		treatmentCache[supplierId] = treatments;
		return treatmentCache[supplierId];
	}

	$effect(() => {
		const lensItemsInCart = items.filter((i): i is LensSaleItemRow => i.kind === 'lens');
		// Read the catalog outside untrack so the effect re-runs once the cache fills with the lens.
		const cacheItems = catalog.getLensItems();
		for (const item of lensItemsInCart) {
			const lens = cacheItems.find((l) => l.id === item.lensPair.catalogItemId);
			untrack(() => {
				if (lens?.supplier?.id && lens.source !== LensCatalogSource.FINISHED) {
					void loadTreatmentsForSupplier(lens.supplier.id);
				}
			});
		}
	});

	const itemTreatmentsMap = $derived.by(() => {
		const map: Record<string, SupplierTreatment[]> = {};
		for (const item of items) {
			if (item.kind !== 'lens') continue;
			const lens = findLensById(item.lensPair.catalogItemId);
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
		const lens = findLensById(lensItem.lensPair.catalogItemId);
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

	function handleCopyRxToAll() {
		copyFirstRxToAll(items);
	}

	const validationReasons = $derived(
		valid ? [] : getValidationReasons(items, getAvailableStockForProduct)
	);

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
			oncopyrx={handleCopyRxToAll}
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
	<Step2ItemsList
		{items}
		{itemTreatmentsMap}
		{lensTreatmentInfo}
		{rxErrorsPerLens}
		onRemoveItem={removeItem}
		onRemoveTreatment={handleRemoveTreatment}
		onOpenTreatment={handleOpenTreatmentSelector}
	/>

	<Step2ValidationHints {valid} reasons={validationReasons} />

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
