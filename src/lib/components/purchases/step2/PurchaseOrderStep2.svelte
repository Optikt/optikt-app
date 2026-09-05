<script lang="ts">
	import { untrack } from 'svelte';
	import {
		createEmptyPurchaseOrderDraftItem,
		applyProductDefaults,
		applyLensDefaults,
		calculateDraftItemTotalAlt,
		calculateOrderSubtotal
	} from '../purchaseOrderDraft';
	import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
	import {
		PurchaseDocumentType,
		PurchaseSourceCurrency,
		getCurrencyLabel
	} from '$lib/shared/enums';
	import { getSourceCurrencySymbol } from '$lib/shared/purchaseOrderCurrencies';
	import type { PurchaseOrderDraftItem } from '../purchaseOrderDraft';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { searchCatalog } from '$lib/remote/catalog.remote';
	import {
		cacheCatalogItems,
		getCachedProducts,
		getCachedLensItems
	} from '../../sales/catalogCache.svelte';
	import { logger } from '$lib/utils';
	import ItemsContextHeader from './ItemsContextHeader.svelte';
	import ProductSearchCombobox from './ProductSearchCombobox.svelte';
	import ItemsList from './ItemsList.svelte';

	interface Props {
		items: PurchaseOrderDraftItem[];
		supplierId: string;
		supplierName: string;
		documentType: PurchaseDocumentType;
		sourceCurrency: string;
		settlementCurrency?: string;
		sourceRateToVes?: number;
		bcvUsdRate: number;
		defaultTaxRate?: number;
	}

	let {
		items = $bindable(),
		supplierId,
		supplierName,
		documentType,
		sourceCurrency,
		settlementCurrency = '',
		sourceRateToVes = 0,
		bcvUsdRate,
		defaultTaxRate = DEFAULT_TAX_RATE
	}: Props = $props();

	const isAltMode = $derived(sourceCurrency !== PurchaseSourceCurrency.USD);
	const currencySymbol = $derived(isAltMode ? getSourceCurrencySymbol(sourceCurrency) : '$');
	const saleSymbol = '$';

	let supplierProducts = $state<ProductWithRelations[]>([]);
	let supplierLenses = $state<LensCatalogItemWithRelations[]>([]);
	let catalogLoading = $state(false);

	// Fetch the supplier's catalog on demand (lazy) instead of SSR-loading everything.
	$effect(() => {
		if (!supplierId) {
			supplierProducts = [];
			supplierLenses = [];
			return;
		}
		catalogLoading = true;
		searchCatalog({ supplierId, limit: 50 })
			.then((results) => {
				cacheCatalogItems(results.products, results.lensItems);
				supplierProducts = results.products;
				supplierLenses = results.lensItems;
			})
			.catch((e) => {
				supplierProducts = [];
				supplierLenses = [];
				logger.error('Error cargando catálogo del proveedor', e);
			})
			.finally(() => {
				catalogLoading = false;
			});
	});

	const lineCount = $derived(items.length);
	const totalItems = $derived(items.reduce((sum, item) => sum + Number(item.quantity || 0), 0));
	const totalCost = $derived(calculateOrderSubtotal(items));
	const totalCostAlt = $derived(
		Math.round(items.reduce((sum, item) => sum + calculateDraftItemTotalAlt(item), 0) * 100) / 100
	);

	const addedProductIds = $derived(
		new Set(items.filter((i) => i.productId).map((i) => i.productId))
	);
	const addedLensIds = $derived(
		new Set(items.filter((i) => i.lensCatalogItemId).map((i) => i.lensCatalogItemId))
	);

	function handleSearchSelect(id: string, kind: 'product' | 'lens') {
		const exists = items.some((item) =>
			kind === 'product' ? item.productId === id : item.lensCatalogItemId === id
		);
		if (exists) return;

		const nextItem = untrack(() => {
			const item = createEmptyPurchaseOrderDraftItem();

			if (kind === 'product') {
				const product = getCachedProducts().find((p) => p.id === id);
				if (product) applyProductDefaults(item, product, documentType, defaultTaxRate);
			} else {
				const lens = getCachedLensItems().find((l) => l.id === id);
				if (lens) applyLensDefaults(item, lens, documentType, defaultTaxRate);
			}

			if (isAltMode) {
				item.unitPurchasePrice = 0;
				item.unitPurchasePriceAlt = 0;
				item.unitSalePrice = 0;
			}

			return item;
		});

		if (nextItem) items = [...items, nextItem];
	}

	function removeItem(itemId: string) {
		items = items.filter((item) => item.id !== itemId);
	}
</script>

<div class="space-y-4">
	<ItemsContextHeader
		{supplierName}
		{sourceCurrency}
		currencyLabel={getCurrencyLabel(settlementCurrency || sourceCurrency)}
		bcvRate={bcvUsdRate}
		{sourceRateToVes}
		{lineCount}
		{totalItems}
		{totalCost}
		{totalCostAlt}
	/>

	<div class="space-y-6 px-4 sm:px-6">
		<ProductSearchCombobox
			products={supplierProducts}
			lensItems={supplierLenses}
			{addedProductIds}
			{addedLensIds}
			{currencySymbol}
			{supplierId}
			disabled={catalogLoading}
			onselect={handleSearchSelect}
		/>

		<ItemsList
			bind:items
			products={supplierProducts}
			lensItems={supplierLenses}
			{currencySymbol}
			{saleSymbol}
			{isAltMode}
			{sourceCurrency}
			{sourceRateToVes}
			{bcvUsdRate}
			onremove={removeItem}
		/>
	</div>
</div>
