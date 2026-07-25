<script lang="ts">
	import { untrack } from 'svelte';
	import {
		createEmptyPurchaseOrderDraftItem,
		applyProductDefaults,
		applyLensDefaults
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
	import PurchaseContextHeader from '../PurchaseContextHeader.svelte';
	import ProductSearchCombobox from './ProductSearchCombobox.svelte';
	import ItemsList from './ItemsList.svelte';

	interface Props {
		items: PurchaseOrderDraftItem[];
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
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
		products,
		lensItems,
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
			const filterProducts = products.filter((p) => p.supplierId === supplierId);
			const filterLenses = lensItems.filter((l) => l.supplierId === supplierId);

			if (kind === 'product') {
				const product = filterProducts.find((p) => p.id === id);
				if (product) applyProductDefaults(item, product, documentType, defaultTaxRate);
			} else {
				const lens = filterLenses.find((l) => l.id === id);
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
	<PurchaseContextHeader
		{supplierName}
		{sourceCurrency}
		currencyLabel={getCurrencyLabel(settlementCurrency || sourceCurrency)}
		bcvRate={bcvUsdRate}
		{sourceRateToVes}
	/>

	<div class="px-4 sm:px-6">
		<ProductSearchCombobox
			{products}
			{lensItems}
			{addedProductIds}
			{addedLensIds}
			{currencySymbol}
			onselect={handleSearchSelect}
		/>

		<ItemsList bind:items {products} {lensItems} {currencySymbol} onremove={removeItem} />
	</div>
</div>
