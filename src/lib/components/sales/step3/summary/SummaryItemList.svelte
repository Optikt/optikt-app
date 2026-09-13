<script lang="ts">
	import { FlaskConical } from '@lucide/svelte';
	import { getContext } from 'svelte';
	import { formatPrice } from '$lib/utils';
	import { DiscountType, TreatmentCategory, getTreatmentCategoryLabel } from '$lib/shared/enums';
	import {
		findLensItem,
		findProduct,
		getItemDiscountBase,
		getItemDiscountMax,
		isItemDiscountValid,
		itemLineTotal
	} from '../../saleItemHelpers';
	import {
		getTaxMeta,
		getDiscountToggleButtonClass,
		type TaxDisplayMeta
	} from './summaryViewModel';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { SaleItemRow, TreatmentSaleItemRow } from '../../newSaleTypes';
	import SaleItemInfo from '../../SaleItemInfo.svelte';
	import { CATALOG_KEY, type CatalogData } from '../../wizardContext';
	import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

	interface Props {
		items: SaleItemRow[];
		defaultTaxRate?: number;
	}

	let { items, defaultTaxRate = DEFAULT_TAX_RATE }: Props = $props();

	const catalog = getContext<CatalogData>(CATALOG_KEY);

	function getProduct(item: SaleItemRow): ProductWithRelations | undefined {
		return findProduct(item, catalog.getProducts());
	}

	function getLens(item: SaleItemRow): LensCatalogItemWithRelations | undefined {
		return findLensItem(item, catalog.getLensItems());
	}

	function getItemTaxMeta(item: SaleItemRow): TaxDisplayMeta {
		if (item.kind === 'product') {
			const product = getProduct(item);
			return getTaxMeta(product?.isTaxable ?? true, defaultTaxRate);
		}

		if (item.kind === 'treatment') {
			return getTaxMeta(item.isTaxable, defaultTaxRate);
		}

		const lens = getLens(item);
		return getTaxMeta(lens?.isTaxable ?? false, defaultTaxRate);
	}
</script>

<div class="min-w-0 flex-1 space-y-1 overflow-y-auto">
	{#each items as item (item.id)}
		{#if item.kind !== 'treatment'}
			{@const itemTaxMeta = getItemTaxMeta(item)}
			<div class="rounded-lg border border-slate-300 bg-white p-1">
				<div class="space-y-1">
					<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
						<SaleItemInfo {item} />
						<div class="flex w-1/3 shrink-0 flex-col items-end gap-1">
							<div class="flex items-center gap-1 text-[10px] text-slate-500">
								<span>CANT {item.kind === 'product' ? item.quantity : 1}</span>
								<span class="text-slate-300">·</span>
								<span>{formatPrice(item.unitPrice)}</span>
								<span class="text-slate-300">·</span>
								<span
									class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold {itemTaxMeta.className}"
								>
									{itemTaxMeta.label}
								</span>
							</div>
							<div class="flex items-center gap-1">
								<div class="inline-flex rounded-md bg-slate-100 p-0.5">
									<button
										type="button"
										onclick={() => {
											item.discountType = DiscountType.FIXED;
										}}
										class="flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold transition-colors {getDiscountToggleButtonClass(
											item.discountType === DiscountType.FIXED
										)}"
									>
										$
									</button>
									<button
										type="button"
										onclick={() => {
											item.discountType = DiscountType.PERCENTAGE;
										}}
										class="flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold transition-colors {getDiscountToggleButtonClass(
											item.discountType === DiscountType.PERCENTAGE
										)}"
									>
										%
									</button>
								</div>
								<input
									type="number"
									bind:value={item.discount}
									step="0.01"
									min="0"
									max={getItemDiscountMax(item)}
									class="w-14 rounded border px-1 py-0.5 text-right font-mono text-[10px] focus:outline-none {isItemDiscountValid(
										item
									)
										? 'border-slate-200 bg-white text-slate-700'
										: 'border-red-300 bg-red-50 text-red-600'}"
								/>
								<div class="rounded-lg bg-surface-container-low px-2 py-1">
									<span class="font-mono text-xs font-semibold text-brand-navy">
										{formatPrice(itemLineTotal(item))}
									</span>
								</div>
							</div>
							{#if !isItemDiscountValid(item)}
								<p class="text-[9px] font-semibold text-error">
									Max: {item.discountType === DiscountType.PERCENTAGE
										? '100%'
										: formatPrice(getItemDiscountBase(item))}
								</p>
							{/if}
						</div>
					</div>
				</div>
				{#if item.kind === 'lens'}
					{@const treatmentItems = items.filter(
						(i): i is TreatmentSaleItemRow =>
							i.kind === 'treatment' && i.parentLensItemId === item.id
					)}
					{#if treatmentItems.length > 0}
						<div class="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
							<div class="mb-1.5 flex items-center gap-1.5">
								<FlaskConical class="h-3 w-3 text-purple-600" />
								<span class="text-[10px] font-semibold tracking-wider text-purple-700 uppercase">
									Tratamientos / Filtros
								</span>
							</div>
							<div class="space-y-1">
								{#each treatmentItems as t (t.id)}
									{@const tQty = t.quantity}
									<div class="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5">
										<div class="flex min-w-0 items-center gap-2">
											<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400"></span>
											<span class="truncate text-xs font-medium text-slate-700"
												>{t.treatmentName}</span
											>
											<span
												class="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase {t.treatmentCategory ===
												TreatmentCategory.AR
													? 'bg-brand-blue/10 text-brand-blue'
													: 'bg-surface-container-high text-on-surface-variant'}"
											>
												{getTreatmentCategoryLabel(t.treatmentCategory)}
											</span>
										</div>
										<div class="flex shrink-0 items-center gap-2">
											<span class="text-[10px] text-slate-400">×{tQty}</span>
											<span class="text-[10px] text-slate-500">{formatPrice(t.unitPrice)}</span>
											<span class="w-14 text-right font-mono text-xs font-semibold text-brand-navy">
												{formatPrice(t.unitPrice * tQty)}
											</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	{/each}
</div>
