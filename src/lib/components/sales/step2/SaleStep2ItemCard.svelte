<script lang="ts">
	import { getContext } from 'svelte';
	import { Trash2, FlaskConical } from '@lucide/svelte';
	import { Label } from '$lib/components/ui/label';
	import { formatPrice } from '$lib/utils';
	import { getTreatmentCategoryLabel } from '$lib/shared/enums/lensTypes';
	import { TreatmentCategory } from '$lib/shared/enums';
	import { findLensItem, step2ItemLineTotal } from '../saleItemHelpers';
	import type { PrescriptionFieldErrors } from '../saleItemHelpers';
	import type { SaleItemRow, TreatmentSaleItemRow } from '../newSaleTypes';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import { CATALOG_KEY, type CatalogData } from '../wizardContext';
	import SaleItemInfo from '../SaleItemInfo.svelte';
	import SaleFormulaSlideOver from './SaleFormulaSlideOver.svelte';
	import SaleCostSlideOver from './SaleCostSlideOver.svelte';
	import TreatmentCostSlideOver from './TreatmentCostSlideOver.svelte';
	import FreeItemFields from './FreeItemFields.svelte';

	interface Props {
		item: SaleItemRow;
		rxErrs?: PrescriptionFieldErrors;
		onremove: () => void;
		eyeCount: number;
		isIncludedAccessory: boolean;
		availableTreatments?: SupplierTreatment[];
		currentTreatmentName?: string | null;
		currentTreatmentTotal?: number;
		onopenTreatment?: (() => void) | undefined;
	}

	let {
		item = $bindable(),
		rxErrs = {},
		onremove,
		eyeCount = 0,
		isIncludedAccessory = false,
		availableTreatments = [],
		currentTreatmentName = null,
		currentTreatmentTotal = 0,
		onopenTreatment = undefined
	}: Props = $props();

	const { products, lensItems } = getContext<CatalogData>(CATALOG_KEY);

	const isLensKind = $derived(item.kind === 'lens');
	const isProductKind = $derived(item.kind === 'product');
	const isTreatmentKind = $derived(item.kind === 'treatment');

	const lens = $derived(item.kind === 'lens' ? findLensItem(item, lensItems) : undefined);
	const maxStock = $derived(
		item.kind === 'product' && item.productId
			? (products.find((p) => p.id === item.productId)?.stock ?? null)
			: null
	);

	let formulaOpen = $state(false);
	let costOpen = $state(false);
	let treatmentCostOpen = $state(false);

	const internalCostTotal = $derived.by(() => {
		if (item.kind !== 'lens' || !lens) return 0;
		const effectiveShipping = item.shippingCostPending ? 0 : item.costOverrides.shippingPrice;
		return item.costOverrides.baseCost + item.costOverrides.mountingPrice + effectiveShipping;
	});

	const treatmentCostPerUnit = $derived.by(() => {
		if (item.kind !== 'treatment') return 0;
		const t = item as TreatmentSaleItemRow;
		return t.costOverride ?? t.purchasePrice;
	});

	const outOfStock = $derived(
		item.kind === 'product' && maxStock !== null && item.quantity > maxStock
	);
</script>

<div
	class="overflow-hidden rounded-lg bg-white p-1 {isIncludedAccessory
		? 'border border-amber-200/80 bg-amber-50/70'
		: 'border border-slate-300 hover:border-slate-400'}"
>
	<div class="space-y-1">
		<!-- Item header row -->
		<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
			{#if isTreatmentKind}
				{@const t = item as TreatmentSaleItemRow}
				<div class="flex min-w-0 items-center gap-3">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-purple-100 bg-purple-50"
					>
						<FlaskConical class="h-4 w-4 text-purple-600" />
					</div>
					<div class="min-w-0">
						<p class="truncate text-sm font-semibold text-brand-navy">{t.treatmentName}</p>
						<div class="flex flex-wrap items-center gap-1.5">
							<span
								class="rounded-full border border-purple-100 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 uppercase"
							>
								Tratamiento
							</span>
							<span
								class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase {t.treatmentCategory ===
								TreatmentCategory.AR
									? 'bg-brand-blue/10 text-brand-blue'
									: 'bg-surface-container-high text-on-surface-variant'}"
							>
								{getTreatmentCategoryLabel(t.treatmentCategory)}
							</span>
						</div>
					</div>
					{#if onopenTreatment}
						<button
							type="button"
							onclick={onopenTreatment}
							class="inline-flex items-center rounded-lg px-1.5 py-0.5 text-xs font-semibold text-brand-blue underline transition-colors hover:bg-brand-blue/10"
						>
							Editar
						</button>
					{/if}
				</div>
			{:else}
				<SaleItemInfo {item} showAccessoryBadge={isIncludedAccessory} />
			{/if}

			<!-- Inline controls row -->
			<div class="flex shrink items-start gap-3">
				<div class="w-16">
					<Label for="qty-{item.id}" class="mb-1 text-[10px] font-semibold text-outline uppercase"
						>Cant</Label
					>

					<input
						id="qty-{item.id}"
						type="number"
						class="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/30"
						disabled={isLensKind || isTreatmentKind}
						min="1"
						max={isProductKind ? (maxStock ?? undefined) : undefined}
						bind:value={item.quantity}
					/>
					{#if outOfStock}
						<p class="mt-0.5 text-[10px] text-red-600">Disp: {maxStock}</p>
					{/if}
				</div>

				<div class="w-20">
					<Label for="price-{item.id}" class="mb-1 text-[10px] font-semibold text-outline uppercase"
						>Precio</Label
					>
					<input
						id="price-{item.id}"
						type="number"
						bind:value={item.unitPrice}
						step="0.01"
						min="0"
						class="w-full rounded-lg border border-slate-200 px-2 py-1 font-mono text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/30"
					/>
				</div>
				<div class="shrink-0">
					<p class="mb-1 text-[10px] font-semibold text-outline uppercase">Total</p>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-1.5">
						<p class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
							{formatPrice(step2ItemLineTotal(item))}
						</p>
					</div>
				</div>
				<div class="flex shrink-0 items-end justify-end">
					<button
						type="button"
						onclick={onremove}
						class="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-error-container/60 hover:text-red-700"
						title="Eliminar ítem"
					>
						<Trash2 class="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>

		<!-- Free item fields -->
		{#if item.kind === 'free' && item.freeItem}
			<FreeItemFields freeItem={item.freeItem} />
		{/if}

		<!-- Treatment cost section -->
		{#if isTreatmentKind}
			{@const t = item as TreatmentSaleItemRow}
			<div
				class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 px-2 pt-2 text-xs"
			>
				<div class="flex items-center gap-1.5">
					<span class="text-on-surface-variant">Costo: </span>
					<span class="font-mono font-semibold text-brand-navy"
						>{formatPrice(t.costOverride ?? t.purchasePrice)}</span
					>
					<span class="text-[10px] text-on-surface-variant">× {t.quantity}</span>
					<button
						type="button"
						onclick={() => (treatmentCostOpen = true)}
						class="inline-flex items-center rounded-lg px-1 py-0.5 text-[10px] font-semibold text-brand-blue underline transition-colors hover:bg-brand-blue/10"
					>
						Editar
					</button>
				</div>
			</div>
		{/if}

		<!-- Lens-specific section -->
		{#if item.kind === 'lens' && item.lensPair?.catalogItemId}
			<div
				class="flex w-2/3 flex-wrap items-center gap-x-4 gap-y-1 divide-x divide-slate-300 border-t border-slate-200 px-2 pt-2 text-xs"
			>
				<div class="flex items-center gap-1.5">
					<span class="font-semibold text-brand-navy">Fórmula</span>
					{#if rxErrs && Object.keys(rxErrs).length > 0}
						<span
							class="rounded-full bg-error-container px-1.5 py-0.5 text-[12px] font-semibold text-on-error-container"
							>Pendiente</span
						>
					{:else if item.lensPair.od.enabled || item.lensPair.oi.enabled}
						<span
							class="rounded-full bg-success-container px-1.5 py-0.5 text-[12px] font-semibold text-on-success-container"
							>Completa</span
						>
					{/if}
					<button
						type="button"
						onclick={() => (formulaOpen = true)}
						class="inline-flex items-center rounded-lg px-1.5 py-0.5 font-semibold text-brand-blue underline transition-colors hover:bg-brand-blue/10"
					>
						Editar
					</button>
				</div>

				{#if item.kind === 'lens' && lens && item.costOverrides}
					<div class="flex items-center gap-1.5">
						<span class="under text-on-surface-variant">Costo: </span>
						<span class="font-mono font-semibold text-brand-navy"
							>{formatPrice(internalCostTotal)}</span
						>
						<button
							type="button"
							onclick={() => (costOpen = true)}
							class="inline-flex items-center rounded-lg px-1.5 py-0.5 font-semibold text-brand-blue underline transition-colors hover:bg-brand-blue/10"
						>
							Editar
						</button>
					</div>
				{/if}

				{#if availableTreatments.length > 0}
					<div class="flex items-center gap-1.5">
						<span class="text-on-surface-variant">Filtros: </span>
						{#if currentTreatmentName}
							<span class="text-xs font-medium text-brand-navy">{currentTreatmentName}</span>
							<span class="font-mono font-semibold text-brand-navy"
								>{formatPrice(currentTreatmentTotal)}</span
							>
						{:else}
							<span class="text-on-surface-variant">—</span>
						{/if}
						<button
							type="button"
							onclick={() => onopenTreatment?.()}
							class="inline-flex items-center rounded-lg px-1.5 py-0.5 font-semibold text-brand-blue underline transition-colors hover:bg-brand-blue/10"
						>
							{currentTreatmentName ? 'Editar' : 'Agregar'}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if item.kind === 'lens' && item.lensPair?.catalogItemId}
		<SaleFormulaSlideOver bind:open={formulaOpen} pair={item.lensPair} />

		<SaleCostSlideOver
			bind:open={costOpen}
			costOverrides={item.costOverrides}
			shippingCostPending={item.shippingCostPending}
			{eyeCount}
		/>
	{/if}

	{#if isTreatmentKind}
		{@const t = item as TreatmentSaleItemRow}
		<TreatmentCostSlideOver
			bind:open={treatmentCostOpen}
			initialCost={t.costOverride ?? t.purchasePrice}
			ineyeCount={t.quantity}
			onapply={(newCost) => (t.costOverride = newCost)}
		/>
	{/if}
</div>
