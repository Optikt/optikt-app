<script lang="ts">
	import { Glasses, Package } from '@lucide/svelte';
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

	const supplierProducts = $derived(
		supplierId === '' ? [] : products.filter((product) => product.supplierId === supplierId)
	);
	const supplierLensItems = $derived(
		supplierId === '' ? [] : lensItems.filter((lens) => lens.supplierId === supplierId)
	);

	const addedProductIds = $derived(new Set(items.map((i) => i.productId).filter(Boolean)));
	const addedLensIds = $derived(new Set(items.map((i) => i.lensCatalogItemId).filter(Boolean)));

	const currencySymbol = $derived(
		sourceCurrency === 'EUR' ? '€' : sourceCurrency === 'VES' ? 'Bs' : '$'
	);

	const itemsTotalCost = $derived(
		isAltMode
			? items.reduce(
					(sum, item) => sum + Number(item.unitPurchasePriceAlt ?? 0) * Number(item.quantity),
					0
				)
			: items.reduce((sum, item) => sum + Number(item.unitPurchasePrice) * Number(item.quantity), 0)
	);

	function setPendingType(itemType: PurchaseOrderItemType) {
		if (pendingItemType === itemType) return;
		pendingItemType = itemType;
	}

	function handleSearchSelect(id: string, kind: 'product' | 'lens') {
		if (kind === 'product') {
			if (items.some((i) => i.productId === id)) return;
		} else {
			if (items.some((i) => i.lensCatalogItemId === id)) return;
		}

		const nextItem = createEmptyPurchaseOrderDraftItem(
			kind === 'product' ? PurchaseOrderItemType.PRODUCT : PurchaseOrderItemType.LENS,
			documentType,
			defaultTaxRate
		);

		if (kind === 'product') {
			const product = supplierProducts.find((p) => p.id === id);
			if (product) {
				applyProductDefaults(nextItem, product, documentType, defaultTaxRate);
			}
		} else {
			const lens = supplierLensItems.find((l) => l.id === id);
			if (lens) {
				applyLensDefaults(nextItem, lens, documentType, defaultTaxRate);
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
	<div class="flex items-center justify-end border-b border-outline-variant/20 pb-2">
		<div class="flex items-center gap-4 text-xs font-medium text-on-surface-variant">
			{#if items.length > 0}
				<span>{items.length} {items.length === 1 ? 'línea' : 'líneas'}</span>
				<div class="h-3 w-px bg-outline-variant/30"></div>
				<span
					>Total:
					<span class="font-mono font-semibold text-brand-navy tabular-nums"
						>{isAltMode ? currencySymbol : 'USD'}
						{itemsTotalCost.toFixed(2)}</span
					></span
				>
			{:else}
				<span class="text-on-surface-variant">0 líneas</span>
			{/if}
		</div>
	</div>

	<div
		class="mt-4 flex items-center gap-2 rounded-xl bg-surface-container-low p-1.5 ring-1 ring-outline-variant/20"
	>
		<div class="flex shrink-0 rounded-lg border border-outline-variant/30 bg-white p-0.5 shadow-sm">
			<button
				type="button"
				onclick={() => setPendingType(PurchaseOrderItemType.LENS)}
				class={[
					'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
					pendingItemType === PurchaseOrderItemType.LENS
						? 'bg-brand-navy text-white shadow-sm'
						: 'text-on-surface-variant hover:text-brand-navy'
				]}
			>
				<Glasses class="h-3.5 w-3.5" />
				Lentes
			</button>
			<button
				type="button"
				onclick={() => setPendingType(PurchaseOrderItemType.PRODUCT)}
				class={[
					'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
					pendingItemType === PurchaseOrderItemType.PRODUCT
						? 'bg-brand-navy text-white shadow-sm'
						: 'text-on-surface-variant hover:text-brand-navy'
				]}
			>
				<Package class="h-3.5 w-3.5" />
				Productos
			</button>
		</div>

		<PurchaseStep2SearchBar
			{products}
			{lensItems}
			{supplierId}
			{pendingItemType}
			{addedProductIds}
			{addedLensIds}
			onselect={handleSearchSelect}
		/>
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
				class="sticky top-0 z-10 hidden bg-surface-container-lowest text-[10px] font-bold tracking-[0.16em] text-on-surface-variant uppercase xl:grid"
				style="grid-template-columns: minmax(120px,1fr) 60px 100px 75px 95px 80px; gap: 0.75rem; padding: 0 0.75rem 0.5rem;"
			>
				<span>Artículo</span>
				<span class="text-center">Cant.</span>
				<span class="text-right">{isAltMode ? `Costo ${currencySymbol}` : 'Costo und.'}</span>
				<span class="text-right">Venta und.</span>
				<span class="text-right">{isAltMode ? `Total ${currencySymbol}` : 'Total'}</span>
				<span class="text-center"></span>
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
