<script lang="ts">
	import { getContext } from 'svelte';
	import { Package, Eye, Trash2 } from '@lucide/svelte';
	import { Input, Label } from 'flowbite-svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import { formatPrice } from '$lib/utils';
	import { getLensSourceLabel, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import { findProduct, findLensItem, step2ItemLineTotal } from '../saleItemHelpers';
	import type { PrescriptionFieldErrors } from '../saleItemHelpers';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import type { SaleItemRow } from '../newSaleTypes';
	import { CATALOG_KEY, type CatalogData } from '../wizardContext';
	import SaleFormulaSlideOver from './SaleFormulaSlideOver.svelte';
	import InternalCostAccordion from './InternalCostAccordion.svelte';
	import LensTreatmentSelector from './LensTreatmentSelector.svelte';
	import FreeItemFields from './FreeItemFields.svelte';

	interface Props {
		item: SaleItemRow;
		availableTreatments: SupplierTreatment[];
		rxErrs: PrescriptionFieldErrors;
		onremove: () => void;
		ontoggletreatment: (treatment: SupplierTreatment) => void;
		onrecalcprice: () => void;
		oncopyoi: () => void;
		lensRangeWarnings: string[];
		eyeCount: number;
		treatmentTotal: number;
		isIncludedAccessory: boolean;
	}

	let {
		item = $bindable(),
		availableTreatments,
		rxErrs = {},
		onremove,
		ontoggletreatment,
		onrecalcprice,
		oncopyoi,
		lensRangeWarnings = [],
		eyeCount = 0,
		treatmentTotal = 0,
		isIncludedAccessory = false
	}: Props = $props();

	const { products, lensItems } = getContext<CatalogData>(CATALOG_KEY);

	const product = $derived(item.kind === 'product' ? findProduct(item, products) : undefined);
	const lens = $derived(item.kind === 'lens' ? findLensItem(item, lensItems) : undefined);
	const maxStock = $derived(
		item.kind === 'product' && item.productId
			? (products.find((p) => p.id === item.productId)?.stock ?? null)
			: null
	);

	let formulaOpen = $state(false);
	let costOpen = $state(false);

	function formatEyeSummary(eye: import('../newSaleTypes').LensEyeEntry): string {
		const parts: string[] = [];
		if (eye.prescription.sphere != null) parts.push(`${eye.prescription.sphere}`);
		if (eye.prescription.cylinder != null) parts.push(`${eye.prescription.cylinder}`);
		if (eye.prescription.axis != null) parts.push(`${eye.prescription.axis}°`);
		if (eye.prescription.addition != null) parts.push(`+${eye.prescription.addition}`);
		if (eye.dp != null) parts.push(`DP ${eye.dp}`);
		if (eye.np != null) parts.push(`NP ${eye.np}`);
		return parts.join(' / ') || '—';
	}
</script>

<div
	class="rounded-lg p-3 {isIncludedAccessory
		? 'border border-amber-200/80 bg-amber-50/70'
		: 'border border-slate-200'}"
>
	<div class="space-y-3">
		<!-- Item header row -->
		<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
			<div class="flex min-w-0 flex-1 items-start gap-2.5">
				<div
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {item.kind === 'lens'
						? 'bg-brand-blue/15 text-brand-blue'
						: 'bg-surface-container-high text-brand-navy'}"
				>
					{#if item.kind === 'lens'}<Eye class="h-3.5 w-3.5" />{:else}<Package
							class="h-3.5 w-3.5"
						/>{/if}
				</div>
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="truncate text-sm font-semibold text-brand-navy">
							{lens?.name ?? product?.name ?? 'Ítem libre'}
						</span>
						{#if item.kind === 'product' && product?.brand}
							<span
								class="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-on-surface-variant uppercase"
								>{product.brand.name}</span
							>
						{/if}
						{#if item.kind === 'lens' && lens}
							<span
								class="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand-blue uppercase"
								>{getLensSourceLabel(lens.source)}</span
							>
							<span
								class="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[9px] font-semibold text-on-surface-variant uppercase"
								>{getLensTypeLabel(lens.type)}</span
							>
						{/if}
						{#if isIncludedAccessory}
							<span
								class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 uppercase"
								>Accesorio</span
							>
						{/if}
					</div>
					{#if item.kind === 'product' && product}
						<p class="mt-0.5 truncate text-[11px] text-on-surface-variant">{product.description}</p>
					{:else if item.kind === 'lens' && lens}
						<p class="mt-0.5 truncate text-[11px] text-on-surface-variant">{lens.supplier?.name}</p>
					{/if}
				</div>
			</div>

			<!-- Inline controls row -->
			<div class="flex shrink-0 items-end gap-3">
				{#if item.kind === 'product'}
					<div>
						<Label for="qty-{item.id}" class="mb-1 text-[10px] font-semibold text-outline uppercase"
							>Cant</Label
						>
						<Input
							id="qty-{item.id}"
							type="number"
							bind:value={item.quantity}
							min="1"
							max={maxStock ?? undefined}
							class="font-mono text-sm"
						/>
					</div>
				{:else if item.kind === 'free'}
					<div>
						<Label for="qty-{item.id}" class="mb-1 text-[10px] font-semibold text-outline uppercase"
							>Cant</Label
						>
						<Input
							id="qty-{item.id}"
							type="number"
							bind:value={item.quantity}
							min="1"
							class="font-mono text-sm"
						/>
					</div>
				{:else}
					<div>
						<Label for="qty-{item.id}" class="mb-1 text-[10px] font-semibold text-outline uppercase"
							>Cant</Label
						>
						<Input id="qty-{item.id}" type="number" value="1" disabled class="font-mono text-sm" />
					</div>
				{/if}
				{#if item.kind === 'product' && maxStock !== null && item.quantity > maxStock}
					<p class="mt-0.5 text-[10px] text-red-600">Disp: {maxStock}</p>
				{/if}
				<div>
					<Label for="price-{item.id}" class="mb-1 text-[10px] font-semibold text-outline uppercase"
						>Precio</Label
					>
					<Input
						id="price-{item.id}"
						type="number"
						bind:value={item.unitPrice}
						step="0.01"
						min="0"
						class="font-mono text-sm"
					/>
				</div>
				<div>
					<p class="mb-1 text-[10px] font-semibold text-outline uppercase">Total</p>
					<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
						<p class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
							{formatPrice(step2ItemLineTotal(item))}
						</p>
					</div>
				</div>
				<div class="flex items-end justify-end">
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

		<!-- Lens-specific section -->
		{#if item.kind === 'lens' && item.lensPair?.catalogItemId}
			<div class="space-y-2 border-t border-slate-100 pt-2">
				<!-- Ojos toggles -->
				<div class="flex flex-wrap items-center gap-3" use:autoAnimate>
					<span class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase"
						>Ojos</span
					>
					<label
						class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-brand-navy shadow-sm"
					>
						<input
							type="checkbox"
							bind:checked={item.lensPair.od.enabled}
							onchange={onrecalcprice}
							class="h-3.5 w-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
						/>
						<span>OD</span>
					</label>
					<label
						class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1 text-xs font-semibold text-brand-navy shadow-sm"
					>
						<input
							type="checkbox"
							bind:checked={item.lensPair.oi.enabled}
							onchange={onrecalcprice}
							class="h-3.5 w-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
						/>
						<span>OI</span>
					</label>
					{#if eyeCount == 0}<p class="text-[10px] font-medium text-red-600">
							Habilita al menos un ojo
						</p>{/if}
				</div>

				{#if lensRangeWarnings.length > 0}
					<div
						class="rounded-lg bg-warning-container/60 px-3 py-2 text-xs text-on-warning-container"
					>
						{#each lensRangeWarnings as warning (warning)}<p>{warning}</p>{/each}
					</div>
				{/if}

				<!-- Fórmula summary + slide-over -->
				<div
					class="flex items-center justify-between rounded-lg bg-surface-container-lowest px-3 py-2"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-1.5 text-xs">
							<span class="font-semibold text-brand-navy">Fórmula</span>
							{#if rxErrs && Object.keys(rxErrs).length > 0}
								<span
									class="rounded-full bg-error-container px-1.5 py-0.5 text-[9px] font-semibold text-on-error-container"
									>Pendiente</span
								>
							{:else if item.lensPair.od.prescription.sphere != null || item.lensPair.oi.prescription.sphere != null}
								<span
									class="rounded-full bg-success-container px-1.5 py-0.5 text-[9px] font-semibold text-on-success-container"
									>Completa</span
								>
							{/if}
						</div>
						{#if item.lensPair.od.prescription.sphere != null || item.lensPair.oi.prescription.sphere != null}
							<p class="mt-0.5 truncate text-[11px] text-on-surface-variant">
								OI: {formatEyeSummary(item.lensPair.oi)}
							</p>
							<p class="truncate text-[11px] text-on-surface-variant">
								OD: {formatEyeSummary(item.lensPair.od)}
							</p>
						{/if}
					</div>
					<button
						type="button"
						onclick={() => (formulaOpen = true)}
						class="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue/10"
					>
						Editar
					</button>
				</div>

				{#if formulaOpen}
					<SaleFormulaSlideOver
						bind:open={formulaOpen}
						pair={item.lensPair}
						{rxErrs}
						itemId={item.id}
						{oncopyoi}
					/>
				{/if}

				<!-- Cost + Treatments grid -->
				<div class="grid gap-2 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]" use:autoAnimate>
					{#if eyeCount > 0 && lens && item.costOverrides}
						<InternalCostAccordion
							costOverrides={item.costOverrides}
							bind:shippingCostPending={item.shippingCostPending}
							{eyeCount}
							bind:open={costOpen}
						/>
					{/if}

					<LensTreatmentSelector
						treatments={item.treatments}
						{availableTreatments}
						{eyeCount}
						{treatmentTotal}
						ontoggle={ontoggletreatment}
					/>
				</div>
			</div>
		{/if}
	</div>
</div>
