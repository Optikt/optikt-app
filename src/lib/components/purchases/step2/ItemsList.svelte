<script lang="ts">
	import { autoAnimate } from '@formkit/auto-animate';
	import type { PurchaseOrderDraftItem } from '../purchaseOrderDraft';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ItemRow from './ItemRow.svelte';
	import ItemCard from './ItemCard.svelte';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';

	interface Props {
		items: PurchaseOrderDraftItem[];
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		currencySymbol: string;
		saleSymbol: string;
		isAltMode?: boolean;
		sourceCurrency?: string;
		sourceRateToVes?: number;
		bcvUsdRate?: number;
		onremove: (itemId: string) => void;
	}

	let {
		items = $bindable(),
		products,
		lensItems,
		currencySymbol,
		saleSymbol,
		isAltMode = false,
		sourceCurrency = 'USD',
		sourceRateToVes = 0,
		bcvUsdRate = 0,
		onremove
	}: Props = $props();

	function getItemName(item: PurchaseOrderDraftItem): string {
		if (item.itemType === 'PRODUCT') {
			const p = products.find((pr) => pr.id === item.productId);
			return p ? `${p.sku} - ${p.name}` : 'Producto';
		}
		const l = lensItems.find((ln) => ln.id === item.lensCatalogItemId);
		return l ? l.name : 'Lente';
	}

	function getItemSku(item: PurchaseOrderDraftItem): string {
		if (item.itemType === 'PRODUCT') {
			const p = products.find((pr) => pr.id === item.productId);
			return p?.sku ?? '';
		}
		return '';
	}
</script>

<div class="space-y-3">
	<div
		class="hidden gap-3 px-3 pb-1 text-[10px] font-semibold tracking-[0.16em] text-on-surface-variant uppercase xl:grid"
		style="grid-template-columns: minmax(160px,1fr) 70px 110px 110px 90px 72px"
	>
		<span>Artículo</span>
		<span class="text-center">Cant.</span>
		<span class="text-right">Costo UND.</span>
		<span class="text-right">Venta UND.</span>
		<span class="text-right">Total</span>
		<span></span>
	</div>

	<div use:autoAnimate class="space-y-2">
		{#if items.length === 0}
			<EmptyState
				message="Todavía no hay líneas en la orden. Busca un artículo arriba y agrégalo a la lista."
			/>
		{:else}
			{#each items as item, index (item.id)}
				<div class="hidden lg:block">
					<ItemRow
						bind:item={items[index]}
						productName={getItemName(item)}
						sku={getItemSku(item)}
						{currencySymbol}
						{saleSymbol}
						{isAltMode}
						{sourceCurrency}
						{sourceRateToVes}
						{bcvUsdRate}
						onremove={() => onremove(item.id)}
					/>
				</div>
				<div class="lg:hidden">
					<ItemCard
						bind:item={items[index]}
						productName={getItemName(item)}
						sku={getItemSku(item)}
						{currencySymbol}
						{saleSymbol}
						{isAltMode}
						{sourceCurrency}
						{sourceRateToVes}
						{bcvUsdRate}
						onremove={() => onremove(item.id)}
					/>
				</div>
			{/each}
		{/if}
	</div>
</div>
