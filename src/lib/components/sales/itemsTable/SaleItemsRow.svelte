<script lang="ts">
	import { Eye, Package, Pencil, Sparkles, Truck } from '@lucide/svelte';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
	import { DiscountType } from '$lib/shared/enums';
	import { FreeItemEnrichmentStatus, SaleItemType } from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';
	import { hasPrescriptionSnapshot } from '$lib/shared/prescriptionSnapshot';
	import {
		iconContainerClasses,
		itemBadge,
		rowHoverClasses,
		splitItemName,
		type DisplayGroup
	} from './itemDisplay';
	import CostEditForm from './CostEditForm.svelte';
	import LensRxPanel from './LensRxPanel.svelte';
	import TreatmentSubRow from './TreatmentSubRow.svelte';

	interface Props {
		group: DisplayGroup;
		expanded: boolean;
		editing: boolean;
		allowCostEdit: boolean;
		supplierMap: Map<string, string>;
		editBaseCost: number;
		editMounting: number;
		editShipping: number;
		editShippingPending: boolean;
		saving: boolean;
		onToggle: () => void;
		onKeydown: (e: KeyboardEvent) => void;
		onStartEnrich: (item: SaleItemWithDetails, isReEnriching?: boolean) => void;
		onStartEdit: (item: SaleItemWithDetails) => void;
		onSaveEdit: () => void;
		onCancelEdit: () => void;
	}

	let {
		group,
		expanded,
		editing,
		allowCostEdit,
		supplierMap,
		editBaseCost = $bindable(),
		editMounting = $bindable(),
		editShipping = $bindable(),
		editShippingPending = $bindable(),
		saving,
		onToggle,
		onKeydown,
		onStartEnrich,
		onStartEdit,
		onSaveEdit,
		onCancelEdit
	}: Props = $props();

	const isLens = $derived(group.item.itemType === SaleItemType.LENS_PAIR);
	const hasRx = $derived(isLens && hasPrescriptionSnapshot(group.item));
	const badge = $derived(itemBadge(group.item.itemType));
	const iconCls = $derived(iconContainerClasses(group.item.itemType));
	const hoverCls = $derived(rowHoverClasses(group.item.itemType));
	const nameParts = $derived(splitItemName(group));
</script>

<div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="grid grid-cols-[3fr_1fr_1fr_1.2fr] items-center gap-2 px-5 py-4 {hasRx
			? `cursor-pointer ${hoverCls} transition-colors`
			: hoverCls}"
		onclick={hasRx ? onToggle : undefined}
		role={hasRx ? 'button' : 'group'}
		tabindex={hasRx ? 0 : undefined}
		onkeydown={hasRx ? onKeydown : undefined}
	>
		<div class="flex min-w-0 items-center gap-3">
			<div
				class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border {iconCls}"
			>
				{#if isLens}
					<Eye class="h-4 w-4" />
				{:else if group.item.itemType === SaleItemType.FREE_ITEM}
					<Sparkles class="h-4 w-4" />
				{:else}
					<Package class="h-4 w-4" />
				{/if}
			</div>
			<div class="min-w-0">
				<div class="flex items-center gap-2">
					<p class="truncate text-sm font-semibold text-gray-900">
						{nameParts.principal}
					</p>
					<span
						class="flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase {badge.classes}"
					>
						{badge.label}
					</span>
				</div>
				<div class="mt-0.5 flex flex-wrap items-center gap-1.5">
					{#if nameParts.details}
						<span class="truncate text-xs text-gray-400">{nameParts.details}</span>
					{/if}
					{#if group.discountAmount > 0}
						<span class="text-[11px] text-red-500">
							-{formatPrice(group.discountAmount)}
							{#if group.item.discountType === DiscountType.PERCENTAGE}
								({group.item.discount}%)
							{/if}
						</span>
					{/if}
				</div>

				{#if group.item.itemType === SaleItemType.FREE_ITEM && group.item.freeDetails}
					{@const fd = group.item.freeDetails}
					{#if fd.enrichmentStatus === FreeItemEnrichmentStatus.PENDING}
						<div
							class="mt-2 rounded-lg bg-warning-container/60 px-3 py-2 text-xs text-on-warning-container"
						>
							<p class="font-semibold">⚠ Pendiente de completar</p>
							<p class="mt-0.5 text-on-surface-variant">Costo y proveedor no registrados aún</p>
							{#if allowCostEdit}
								<button
									type="button"
									onclick={() => onStartEnrich(group.item)}
									class="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
								>
									Completar ítem →
								</button>
							{/if}
						</div>
					{:else if fd.enrichmentStatus === FreeItemEnrichmentStatus.ENRICHED}
						<div class="mt-2 space-y-0.5 text-xs text-on-surface-variant">
							<div class="flex items-center justify-between gap-2">
								<p class="font-semibold text-green-700">✓ Completado</p>
								{#if allowCostEdit}
									<button
										type="button"
										onclick={() => onStartEnrich(group.item, true)}
										class="inline-flex items-center gap-1 rounded-lg bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-highest"
									>
										<Pencil size={11} />
										Editar
									</button>
								{/if}
							</div>
							{#if fd.unitCost != null}
								<p>
									Costo: <span class="font-mono font-semibold">{formatPrice(fd.unitCost)}</span>
									{#if fd.unitCost > 0}
										· Margen: <span class="font-semibold"
											>{Math.round(
												((group.item.unitPrice - fd.unitCost) / fd.unitCost) * 100
											)}%</span
										>
									{/if}
								</p>
							{/if}
							{#if fd.supplierId}
								{@const supplierName = supplierMap.get(fd.supplierId)}
								{#if supplierName}
									<p>Proveedor: <span class="font-semibold">{supplierName}</span></p>
								{/if}
							{/if}
							{#if fd.opticalNotes}
								<p class="italic">{fd.opticalNotes}</p>
							{/if}
						</div>
					{/if}
				{/if}

				{#if isLens && (group.item.snapshotBaseCost != null || group.item.snapshotMountingPrice != null || group.item.snapshotShippingPrice != null)}
					{#if editing}
						<CostEditForm
							bind:editBaseCost
							bind:editMounting
							bind:editShipping
							bind:editShippingPending
							{saving}
							onSave={onSaveEdit}
							onCancel={onCancelEdit}
						/>
					{:else}
						{@const baseCost = group.item.snapshotBaseCost ?? 0}
						{@const mounting = group.item.snapshotMountingPrice ?? 0}
						{@const shipping = group.item.snapshotShippingPrice ?? 0}
						{@const isPending = group.item.shippingCostPending ?? false}
						{@const costTotal =
							group.item.snapshotCostTotal ?? baseCost + mounting + (isPending ? 0 : shipping)}
						<div
							class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant"
						>
							<span
								>Cristales: <span class="font-mono text-brand-navy">{formatPrice(baseCost)}</span
								></span
							>
							{#if mounting > 0}
								<span
									>Montaje: <span class="font-mono text-brand-navy">{formatPrice(mounting)}</span
									></span
								>
							{/if}
							{#if isPending}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-warning-container px-2 py-0.5 text-[10px] font-semibold tracking-wide text-on-warning-container"
								>
									<Truck class="h-3 w-3" />
									Envío pendiente
								</span>
							{:else if shipping > 0}
								<span
									>Envío: <span class="font-mono text-brand-navy">{formatPrice(shipping)}</span
									></span
								>
							{/if}
							<span class="font-semibold"
								>Total: <span class="font-mono text-brand-navy">{formatPrice(costTotal)}</span
								></span
							>
							{#if allowCostEdit}
								<button
									type="button"
									onclick={() => onStartEdit(group.item)}
									class="inline-flex items-center justify-center rounded-md p-1 text-outline transition-colors hover:bg-surface-container-high hover:text-brand-navy"
									title="Editar costos"
								>
									<Pencil class="h-3.5 w-3.5" />
								</button>
							{/if}
						</div>
					{/if}
				{:else if isLens}
					<div class="mt-2 flex items-center gap-2 text-xs text-outline">
						<span>Sin costos registrados</span>
						{#if allowCostEdit}
							<button
								type="button"
								onclick={() => onStartEdit(group.item)}
								class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-brand-blue transition-colors hover:bg-surface-container-high"
							>
								<Pencil class="h-3 w-3" />
								Agregar
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<span class="text-center text-sm font-medium text-gray-700">{group.quantity}</span>
		<span class="text-right text-sm text-gray-500">{formatPrice(group.item.unitPrice)}</span>
		<div class="flex items-center justify-end gap-1.5">
			<span class="text-sm font-bold text-gray-900">{formatPrice(group.lineTotal)}</span>
			{#if hasRx}
				<div
					class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100"
				>
					<svg
						class="h-3 w-3 text-gray-500 transition-transform duration-200"
						class:rotate-180={expanded}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
					</svg>
				</div>
			{/if}
		</div>
	</div>

	{#if hasRx}
		<div
			class="overflow-hidden transition-all duration-300 ease-in-out"
			class:max-h-[500px]={expanded}
			class:opacity-100={expanded}
			class:max-h-0={!expanded}
			class:opacity-0={!expanded}
		>
			<LensRxPanel item={group.item} />
		</div>
	{/if}

	{#each group.treatments as treatment (treatment.id)}
		<TreatmentSubRow {treatment} />
	{/each}
</div>
