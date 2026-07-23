<script lang="ts">
	import { getContext } from 'svelte';
	import { Package, Eye, Sparkles } from '@lucide/svelte';
	import { getLensSourceLabel, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import { findProduct, findLensItem } from './saleItemHelpers';
	import type { SaleItemRow } from './newSaleTypes';
	import { CATALOG_KEY, type CatalogData } from './wizardContext';
	import EyeSummary from '$lib/components/ui/EyeSummary.svelte';
	import { getTreatmentCategoryLabel } from '$lib/shared/enums/lensTypes';
	import { getProductTypeIcon } from '$lib/components/ui/productTypeIcons';
	import { ProductType } from '$lib/shared/enums/productTypes';

	interface Props {
		item: SaleItemRow;
		showAccessoryBadge?: boolean;
	}

	let { item, showAccessoryBadge = false }: Props = $props();

	const { products, lensItems } = getContext<CatalogData>(CATALOG_KEY);

	const isLensKind = $derived(item.kind === 'lens');
	const isProductKind = $derived(item.kind === 'product');

	const product = $derived(item.kind === 'product' ? findProduct(item, products) : undefined);
	const lens = $derived(item.kind === 'lens' ? findLensItem(item, lensItems) : undefined);

	const productTypeIcon = $derived(
		item.kind === 'product' && product?.type ? getProductTypeIcon(product.type) : undefined
	);
</script>

<div class="flex w-2/3 min-w-0 flex-1 items-start gap-2.5">
	<div
		class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {isLensKind
			? 'bg-brand-blue/15 text-brand-blue'
			: item.kind === 'treatment'
				? 'bg-purple-100 text-purple-600'
				: product?.type === ProductType.FRAME
					? 'bg-blue-100 text-blue-600'
					: product?.type === ProductType.SUNGLASSES
						? 'bg-green-100 text-green-600'
						: product?.type === ProductType.CONTACT_LENS
							? 'bg-purple-100 text-purple-600'
							: product?.type === ProductType.ACCESSORY
								? 'bg-yellow-100 text-yellow-600'
								: 'bg-surface-container-high text-brand-navy'}"
	>
		{#if isLensKind}
			<Eye class="h-3.5 w-3.5" />
		{:else if item.kind === 'treatment'}
			<Sparkles class="h-3.5 w-3.5" />
		{:else if isProductKind && productTypeIcon}
			<productTypeIcon class="h-3.5 w-3.5"></productTypeIcon>
		{:else}
			<Package class="h-3.5 w-3.5" />
		{/if}
	</div>
	<div class="w-full min-w-0">
		<div class="flex w-full flex-col flex-wrap items-start gap-y-1">
			<span class="truncate text-sm font-semibold text-brand-navy">
				{item.kind === 'treatment'
					? item.treatmentName
					: (lens?.name ?? product?.name ?? 'Ítem libre')}
			</span>
			<div class="flex items-center gap-2">
				{#if item.kind === 'treatment'}
					<span
						class="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 uppercase"
					>
						Tratamiento
					</span>
					{#if item.treatmentCategory}
						<span
							class="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-blue uppercase"
						>
							{getTreatmentCategoryLabel(item.treatmentCategory)}
						</span>
					{/if}
					{#if item.snapshotBrand}
						<span
							class="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-on-surface-variant uppercase"
						>
							{item.snapshotBrand}
						</span>
					{/if}
				{:else if isProductKind && product}
					{#if product.description}
						<p class="mt0.5 truncate text-[11px] text-on-surface-variant">
							{product.description}
						</p>
					{/if}
					{#if product.brand}
						<span
							class="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-on-surface-variant uppercase"
						>
							{product.brand.name}
						</span>
					{/if}
				{:else if isLensKind && lens}
					{#if lens.supplier?.name}
						<p class="truncate text-[12px] font-semibold text-on-surface-variant">
							{lens.supplier.name}
						</p>
					{/if}
					<span
						class="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-blue uppercase"
					>
						{getLensSourceLabel(lens.source)}
					</span>
					<span
						class="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant uppercase"
					>
						{getLensTypeLabel(lens.type)}
					</span>
				{/if}

				{#if showAccessoryBadge}
					<span
						class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 uppercase"
					>
						Accesorio
					</span>
				{/if}
			</div>

			{#if item.kind === 'lens'}
				<div>
					<EyeSummary eye="OI" lensEntry={item.lensPair.oi} />
					<EyeSummary eye="OD" lensEntry={item.lensPair.od} />
				</div>
			{/if}
		</div>
	</div>
</div>
