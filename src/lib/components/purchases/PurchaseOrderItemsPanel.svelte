<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { AppBadge, SegmentedToggle } from '$lib/components/ui';
	import {
		PurchaseDocumentType,
		PurchaseOrderItemType,
		PurchaseSourceCurrency
	} from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import PurchaseOrderItemRow from './PurchaseOrderItemRow.svelte';
	import PurchaseStep2SearchBar from './PurchaseStep2SearchBar.svelte';
	import {
		applyLensDefaults,
		applyProductDefaults,
		createEmptyPurchaseOrderDraftItem,
		type PurchaseOrderDraftItem
	} from './purchaseOrderDraft';
	import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

	interface Props {
		items: PurchaseOrderDraftItem[];
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		supplierId: string;
		documentType: PurchaseDocumentType;
		sourceCurrency: string;
		bcvUsdRate: number;
		sourceRateToVes?: number;
		defaultTaxRate?: number;
	}

	let {
		items = $bindable(),
		products,
		lensItems,
		supplierId,
		documentType,
		sourceCurrency,
		bcvUsdRate,
		sourceRateToVes = 0,
		defaultTaxRate = DEFAULT_TAX_RATE
	}: Props = $props();

	const isAltMode = $derived(sourceCurrency !== PurchaseSourceCurrency.USD);

	let pendingItemType = $state(PurchaseOrderItemType.PRODUCT);
	let pendingProductId = $state('');
	let pendingLensCatalogItemId = $state('');

	const supplierProducts = $derived(
		supplierId === '' ? [] : products.filter((product) => product.supplierId === supplierId)
	);
	const supplierLensItems = $derived(
		supplierId === '' ? [] : lensItems.filter((lens) => lens.supplierId === supplierId)
	);

	const addedProductIds = $derived(new Set(items.map((i) => i.productId).filter(Boolean)));
	const addedLensIds = $derived(new Set(items.map((i) => i.lensCatalogItemId).filter(Boolean)));

	const canAddLine = $derived(
		supplierId !== '' &&
			(pendingItemType === PurchaseOrderItemType.PRODUCT
				? pendingProductId !== ''
				: pendingLensCatalogItemId !== '')
	);

	const currencySymbol = $derived(
		sourceCurrency === 'EUR' ? '€' : sourceCurrency === 'VES' ? 'Bs' : '$'
	);

	function setPendingType(itemType: PurchaseOrderItemType) {
		if (pendingItemType === itemType) return;
		pendingItemType = itemType;
		pendingProductId = '';
		pendingLensCatalogItemId = '';
	}

	function handleSearchSelect(id: string, _kind: 'product' | 'lens') {
		if (_kind === 'product') {
			pendingProductId = id;
		} else {
			pendingLensCatalogItemId = id;
		}
	}

	function addLine() {
		if (!canAddLine) return;

		const nextItem = createEmptyPurchaseOrderDraftItem(
			pendingItemType,
			documentType,
			defaultTaxRate
		);

		if (pendingItemType === PurchaseOrderItemType.PRODUCT) {
			const product = supplierProducts.find((p) => p.id === pendingProductId);
			if (product) {
				applyProductDefaults(nextItem, product, documentType, defaultTaxRate);
				pendingProductId = '';
			}
		} else {
			const lens = supplierLensItems.find((l) => l.id === pendingLensCatalogItemId);
			if (lens) {
				applyLensDefaults(nextItem, lens, documentType, defaultTaxRate);
				pendingLensCatalogItemId = '';
			}
		}

		if (isAltMode) {
			nextItem.unitPurchasePrice = 0;
			nextItem.unitPurchasePriceAlt = 0;
		}

		items = [...items, nextItem];
	}

	function removeLine(itemId: string) {
		items = items.filter((item) => item.id !== itemId);
	}
</script>

<section class="rounded-2xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant/20 sm:p-5">
	<div class="flex items-center gap-3">
		<h2 class="text-lg font-semibold text-brand-navy">Artículos</h2>
		<AppBadge variant="neutral">{items.length} líneas</AppBadge>
	</div>

	<div class="mt-4 flex flex-wrap items-center gap-3">
		<SegmentedToggle
			value={pendingItemType}
			options={[
				{ value: PurchaseOrderItemType.PRODUCT, label: 'Producto' },
				{ value: PurchaseOrderItemType.LENS, label: 'Lente' }
			]}
			onchange={(val) => setPendingType(val as PurchaseOrderItemType)}
		/>

		<PurchaseStep2SearchBar
			{products}
			{lensItems}
			{supplierId}
			{pendingItemType}
			{addedProductIds}
			{addedLensIds}
			onselect={handleSearchSelect}
		/>

		<button
			type="button"
			onclick={addLine}
			disabled={!canAddLine}
			class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
		>
			<Plus class="h-4 w-4" />
			Agregar línea
		</button>
	</div>

	<div class="mt-5 space-y-3">
		{#if items.length === 0}
			<div
				class="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low px-5 py-8 text-center text-sm text-on-surface-variant"
			>
				Todavía no hay líneas en la orden. Busca un artículo arriba y agrégalo a la lista.
			</div>
		{:else}
			<div
				class="hidden text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase xl:grid"
				style="grid-template-columns: minmax(120px,1fr) 60px 200px 75px 100px 95px 80px; gap: 1rem;"
			>
				<span>Artículo</span>
				<span class="text-center">Cant.</span>
				<span>{isAltMode ? `Costo ${currencySymbol} base` : 'Costo und.'}</span>
				<span>Venta und.</span>
				<span>IVA</span>
				<span class="text-right">{isAltMode ? `Total ${currencySymbol}` : 'Total'}</span>
				<span class="text-center">Checks</span>
			</div>

			{#each items as item, index (item.id)}
				<PurchaseOrderItemRow
					bind:item={items[index]}
					product={products.find((product) => product.id === item.productId) ?? null}
					lensItem={lensItems.find((lens) => lens.id === item.lensCatalogItemId) ?? null}
					{sourceCurrency}
					{bcvUsdRate}
					{sourceRateToVes}
					showRemove={true}
					onremove={() => removeLine(item.id)}
				/>
			{/each}
		{/if}
	</div>
</section>
