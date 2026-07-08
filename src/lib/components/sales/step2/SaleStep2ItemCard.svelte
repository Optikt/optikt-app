<script lang="ts">
	import { getContext } from 'svelte';
	import { Package, Eye, Trash2 } from '@lucide/svelte';
	import { Input, Label } from 'flowbite-svelte';
	import { formatPrice } from '$lib/utils';
	import { getLensSourceLabel, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import { findProduct, findLensItem, step2ItemLineTotal } from '../saleItemHelpers';
	import type { LensConfirmationEye, PrescriptionFieldErrors } from '../saleItemHelpers';
	import type { LensEyeEntry, SaleItemRow } from '../newSaleTypes';
	import { CATALOG_KEY, type CatalogData } from '../wizardContext';
	import SaleFormulaSlideOver from './SaleFormulaSlideOver.svelte';
	import SaleCostSlideOver from './SaleCostSlideOver.svelte';
	import FreeItemFields from './FreeItemFields.svelte';

	interface Props {
		item: SaleItemRow;
		rxErrs: PrescriptionFieldErrors;
		onremove: () => void;
		oncopyoi: () => void;
		eyeCount: number;
		isIncludedAccessory: boolean;
	}

	let {
		item = $bindable(),
		rxErrs = {},
		onremove,
		oncopyoi,
		eyeCount = 0,
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

	const internalCostTotal = $derived.by(() => {
		if (!lens || !item.costOverrides) return 0;
		const effectiveShipping = item.shippingCostPending ? 0 : item.costOverrides.shippingPrice;
		return item.costOverrides.baseCost + item.costOverrides.mountingPrice + effectiveShipping;
	});

	function formatEyeSummary(eye: LensEyeEntry): { label: string; value: string }[] {
		const parts: { label: string; value: string }[] = [];
		if (eye.prescription.sphere != null)
			parts.push({ label: 'ESF', value: `${eye.prescription.sphere}` });
		if (eye.prescription.cylinder != null)
			parts.push({ label: 'CIL', value: `${eye.prescription.cylinder}` });
		if (eye.prescription.axis != null)
			parts.push({ label: 'EJE', value: `${eye.prescription.axis}°` });
		if (eye.prescription.addition != null)
			parts.push({ label: 'ADD', value: `+${eye.prescription.addition}` });
		if (eye.dp != null) parts.push({ label: 'DP', value: `${eye.dp}` });
		if (eye.np != null) parts.push({ label: 'NP', value: `${eye.np}` });
		return parts;
	}
</script>

{#snippet eyeSummary(eye: LensConfirmationEye, lensEntry: LensEyeEntry)}
	{@const segments = formatEyeSummary(lensEntry)}
	<p class="truncate font-mono text-[12px] text-wrap text-on-surface-variant">
		<span class="font-bold"><span class="underline">{eye}</span>:</span>
		{#each segments as seg, i}
			{#if i > 0}<span class="text-slate-500">&nbsp;/</span>{/if}
			<span class="font-semibold text-brand-navy">{seg.label}</span>&nbsp;{seg.value}
		{/each}
	</p>
{/snippet}

<div
	class="rounded-lg bg-white p-1 {isIncludedAccessory
		? 'border border-amber-200/80 bg-amber-50/70'
		: 'border border-slate-300 hover:border-slate-400'}"
>
	<div class="space-y-1">
		<!-- Item header row -->
		<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
			<div class="flex w-2/3 min-w-0 flex-1 items-start gap-2.5">
				<div
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg {item.kind === 'lens'
						? 'bg-brand-blue/15 text-brand-blue'
						: 'bg-surface-container-high text-brand-navy'}"
				>
					{#if item.kind === 'lens'}<Eye class="h-3.5 w-3.5" />{:else}<Package
							class="h-3.5 w-3.5"
						/>{/if}
				</div>
				<div class="min-w-0 w-full">
					<div class="flex flex-col flex-wrap items-start gap-y-1 w-full">
						<span class="truncate text-sm font-semibold text-brand-navy">
							{lens?.name ?? product?.name ?? 'Ítem libre'}
						</span>
						<div
							class={[
								'flex items-center gap-2',
								{
									'w-2/3 border-b border-slate-200 pb-0.5':
										item.kind === 'lens' &&
										item.lensPair &&
										(item.lensPair.od.prescription.sphere != null ||
											item.lensPair.oi.prescription.sphere != null)
								}
							]}
						>
							<!-- Products -->
							{#if item.kind === 'product' && product}
								{#if product.description}
									<p class="mt0.5 truncate text-[11px] text-on-surface-variant">
										{product.description}
									</p>
								{/if}
								{#if product.brand}
									<span
										class="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-on-surface-variant uppercase"
										>{product.brand.name}</span
									>
								{/if}
							{/if}

							<!-- Lenses -->
							{#if item.kind === 'lens' && lens}
								{#if lens.supplier?.name}
									<p class="truncate text-[12px] font-semibold text-on-surface-variant">
										{lens.supplier.name}
									</p>
								{/if}
								<span
									class="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-blue uppercase"
									>{getLensSourceLabel(lens.source)}</span
								>
								<span
									class="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold text-on-surface-variant uppercase"
									>{getLensTypeLabel(lens.type)}</span
								>
							{/if}

							<!-- Included accesory -->
							{#if isIncludedAccessory}
								<span
									class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 uppercase"
									>Accesorio</span
								>
							{/if}
						</div>

						{#if item.kind === 'lens' && item.lensPair && (item.lensPair.od.prescription.sphere != null || item.lensPair.oi.prescription.sphere != null)}
							<div>
								{@render eyeSummary('OI', item.lensPair.oi)}
								{@render eyeSummary('OD', item.lensPair.od)}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Inline controls row -->
			<div class="flex w-1/3 shrink-0 items-start gap-3">
				<div class="w-1/2">
					<Label for="qty-{item.id}" class="mb-1 text-[10px] font-semibold text-outline uppercase"
						>Cant</Label
					>

					<Input
						id="qty-{item.id}"
						type="number"
						class="font-mono text-sm"
						disabled={item.kind === 'lens'}
						min="1"
						max={item.kind === 'product' ? (maxStock ?? undefined) : undefined}
						bind:value={item.quantity}
					/>
					{#if item.kind === 'product' && maxStock !== null && item.quantity > maxStock}
						<p class="mt-0.5 text-[10px] text-red-600">Disp: {maxStock}</p>
					{/if}
				</div>

				<div class="w-1/2">
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
					{:else if item.lensPair.od.prescription.sphere != null || item.lensPair.oi.prescription.sphere != null}
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

				{#if lens && item.costOverrides}
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

			{#if costOpen}
				<SaleCostSlideOver
					bind:open={costOpen}
					costOverrides={item.costOverrides!}
					bind:shippingCostPending={item.shippingCostPending}
					{eyeCount}
				/>
			{/if}
		{/if}
	</div>
</div>
