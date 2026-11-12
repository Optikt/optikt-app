<script lang="ts">
	import { ChevronDown, Pencil, Sparkles, Truck } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
	import { SaleItemType, FreeItemEnrichmentStatus } from '$lib/shared/enums/lensTypes';
	import { formatCurrency, formatPrice, getProfitMargin } from '$lib/utils';
	import { hasPrescriptionSnapshot } from '$lib/shared/prescriptionSnapshot';
	import { rxRowLine, discountChip } from '$lib/components/commercialDocument/itemView';
	import { ITEM_KIND_ICONS } from '$lib/components/commercialDocument/tones';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import {
		itemKind,
		itemKindTooltip,
		itemLabel,
		itemSubtitle,
		type DisplayGroup
	} from './itemDisplay';
	import CostEditForm from './CostEditForm.svelte';
	import LensRxPanel from './LensRxPanel.svelte';

	interface Props {
		group: DisplayGroup;
		expanded: boolean;
		editing: boolean;
		allowCostEdit: boolean;
		/** "Costos internos" switch (off by default): reveals cost + margin chips. */
		showCosts: boolean;
		/** Resolved BCV rate for the Bs. column; null hides it. */
		bsRate: number | null;
		bsApproximate: boolean;
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
		showCosts,
		bsRate,
		bsApproximate,
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

	const item = $derived(group.item);
	const kind = $derived(itemKind(item.itemType));
	const KindIcon = $derived(ITEM_KIND_ICONS[kind].icon);
	const isLens = $derived(item.itemType === SaleItemType.LENS_PAIR);
	const hasRx = $derived(isLens && hasPrescriptionSnapshot(item));
	const title = $derived(itemLabel(group));
	const subtitle = $derived(itemSubtitle(group));
	const showChevron = $derived(isLens);

	/** Collapsed prescription: one line per eye (drawer parity via shared rxRowLine). */
	function eyeArgs(eye: 'od' | 'os') {
		return {
			sphere: eye === 'od' ? item.odSphere : item.osSphere,
			cylinder: eye === 'od' ? item.odCylinder : item.osCylinder,
			axis: eye === 'od' ? item.odAxis : item.osAxis,
			addition: eye === 'od' ? item.odAddition : item.osAddition
		};
	}
	function hasEyeRx(eye: 'od' | 'os'): boolean {
		const values = [
			eye === 'od' ? item.odSphere : item.osSphere,
			eye === 'od' ? item.odCylinder : item.osCylinder,
			eye === 'od' ? item.odAxis : item.osAxis,
			eye === 'od' ? item.odAddition : item.osAddition
		];
		return values.some((value) => value != null);
	}

	const odLine = $derived(rxRowLine('OD', !hasEyeRx('od'), eyeArgs('od')));
	const oiLine = $derived(rxRowLine('OI', !hasEyeRx('os'), eyeArgs('os')));

	const freeDetails = $derived(item.freeDetails);
	const isPendingFree = $derived(
		item.itemType === SaleItemType.FREE_ITEM &&
			freeDetails?.enrichmentStatus === FreeItemEnrichmentStatus.PENDING
	);
	const isEnrichedFree = $derived(
		item.itemType === SaleItemType.FREE_ITEM &&
			freeDetails?.enrichmentStatus === FreeItemEnrichmentStatus.ENRICHED
	);

	// ── Internal cost + margin (visible only with the costs switch on) ─────
	const costTotal = $derived.by(() => {
		if (item.itemType === SaleItemType.FREE_ITEM) {
			return isEnrichedFree ? (freeDetails?.unitCost ?? 0) * group.quantity : null;
		}
		if (item.itemType === SaleItemType.LENS_PAIR) {
			if (item.snapshotCostTotal != null) return item.snapshotCostTotal;
			if (item.snapshotBaseCost == null && item.snapshotMountingPrice == null) return null;
			const shipping = item.shippingCostPending ? 0 : (item.snapshotShippingPrice ?? 0);
			return (item.snapshotBaseCost ?? 0) + (item.snapshotMountingPrice ?? 0) + shipping;
		}
		if (item.snapshotCostTotal != null) return item.snapshotCostTotal;
		if (item.snapshotCostUnit != null) return item.snapshotCostUnit * group.quantity;
		return null;
	});
	const marginLabel = $derived(
		costTotal !== null && costTotal > 0 ? getProfitMargin(costTotal, group.lineTotal) : null
	);

	const bsLineTotal = $derived(bsRate !== null && bsRate > 0 ? group.lineTotal * bsRate : null);

	function bsLabel(value: number): string {
		return `${bsApproximate ? '≈ ' : ''}Bs. ${formatCurrency(value)}`;
	}

	/** Link to the item's record: lens → Catálogo Lentes, product → Inventario. */
	const href = $derived.by(() => {
		if (item.itemType === SaleItemType.LENS_PAIR && item.lensCatalogItem) {
			return resolve(`/lenses/${item.lensCatalogItem.id}`);
		}
		if (item.itemType === SaleItemType.PRODUCT && item.product) {
			return resolve(`/products/${item.product.id}`);
		}
		return null;
	});

	/** Row click toggles the formula; clicks on links/buttons/inputs do their own thing. */
	function handleRowClick(event: MouseEvent) {
		if (!isLens || editing) return;
		const target = event.target as HTMLElement | null;
		// Note: NOT `[role="button"]` — that selector matches the row itself and
		// would block every row click (only nested real controls stop the toggle).
		if (target?.closest('a, button, input, select, textarea')) return;
		onToggle();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	role={isLens ? 'button' : 'group'}
	tabindex={isLens ? 0 : undefined}
	aria-expanded={isLens ? expanded : undefined}
	onclick={handleRowClick}
	onkeydown={isLens ? onKeydown : undefined}
	class="grid grid-cols-[32px_1fr_104px_128px_26px] items-start gap-3 border-t border-outline-variant/60 px-4 py-2.5 transition-colors duration-150 hover:bg-[#f6f8fb] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-blue"
>
	<!-- Neutral kind chip -->
	{#snippet chipTooltipOuter({ props }: { props: Record<string, unknown> })}
		<span
			{...props}
			class="grid h-[32px] w-[32px] shrink-0 cursor-help place-items-center rounded-lg {ITEM_KIND_ICONS[
				kind
			].chipClass}"
		>
			<KindIcon class="h-4 w-4" />
		</span>
	{/snippet}
	<TriggerTooltip trigger={chipTooltipOuter} text={itemKindTooltip(kind)} />

	<!-- Name + meta + rx + states -->
	<div class="min-w-0">
		<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
			{#if href}
				<a
					{href}
					onclick={(e) => e.stopPropagation()}
					class="text-sm font-semibold text-on-surface transition-colors hover:text-on-info-container hover:underline hover:underline-offset-2"
					>{title}</a
				>
			{:else}
				<span class="text-sm font-semibold text-on-surface">{title}</span>
			{/if}
			{#if group.quantity > 1}
				<span
					class="rounded bg-surface-container-high px-1.5 py-px text-[11px] font-bold text-on-surface-variant tabular-nums"
				>
					×{group.quantity}
				</span>
			{/if}
			{#if item.discount && item.discount > 0}
				<span class="text-[11px] font-semibold text-error">
					{discountChip(item.discount, item.discountType)}
				</span>
			{/if}
		</div>

		{#if subtitle}
			<p class="mt-0.5 truncate text-xs text-on-surface-variant">{subtitle}</p>
		{/if}

		{#if hasRx}
			{#if !expanded}
				<div class="mt-1 space-y-0.5 text-xs text-on-surface">
					<p class="font-medium">{odLine}</p>
					<p class="font-medium">{oiLine}</p>
				</div>
			{/if}
		{/if}

		{#if isPendingFree}
			<div
				class="mt-2 flex items-center gap-2 rounded-md bg-warning-container px-2.5 py-1.5 text-xs font-semibold text-on-warning-container"
			>
				<Sparkles class="h-3.5 w-3.5 shrink-0" />
				<span class="min-w-0">Costo y proveedor sin registrar</span>
				{#if allowCostEdit}
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation();
							onStartEnrich(item);
						}}
						class="ml-auto shrink-0 rounded-md border border-current px-2 py-1 text-[11px] font-bold transition-colors hover:bg-black/5"
					>
						Completar ítem →
					</button>
				{/if}
			</div>
		{:else if isEnrichedFree && showCosts}
			<div class="mt-2 flex flex-wrap items-center gap-1.5">
				{#if costTotal !== null}
					<span
						class="rounded bg-surface-container-high px-2 py-0.5 font-mono text-xs text-on-surface"
					>
						Costo {formatPrice(costTotal)}
					</span>
				{/if}
				{#if marginLabel}
					<span
						class="rounded bg-success-container px-2 py-0.5 font-mono text-xs font-semibold text-on-success-container"
					>
						Margen {marginLabel}
					</span>
				{/if}
				{#if allowCostEdit}
					<button
						type="button"
						aria-label="Editar costos"
						onclick={(e) => {
							e.stopPropagation();
							onStartEnrich(item, true);
						}}
						class="rounded-md p-1 text-outline transition-colors hover:bg-surface-container-high hover:text-brand-navy"
					>
						<Pencil class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>
		{/if}

		{#if isLens && showCosts && !editing}
			{#if costTotal !== null}
				<div class="mt-2 flex flex-wrap items-center gap-1.5">
					<span
						class="rounded bg-surface-container-high px-2 py-0.5 font-mono text-xs text-on-surface"
					>
						Cristales {formatPrice(item.snapshotBaseCost ?? 0)} · Montaje {formatPrice(
							item.snapshotMountingPrice ?? 0
						)}
						{#if item.shippingCostPending}
							· Envío pendiente
						{:else if (item.snapshotShippingPrice ?? 0) > 0}
							· Envío {formatPrice(item.snapshotShippingPrice ?? 0)}
						{/if}
						· Total {formatPrice(costTotal)}
					</span>
					{#if marginLabel}
						<span
							class="rounded bg-success-container px-2 py-0.5 font-mono text-xs font-semibold text-on-success-container"
						>
							Margen {marginLabel}
						</span>
					{/if}
					{#if allowCostEdit}
						<button
							type="button"
							aria-label="Editar costos"
							onclick={(e) => {
								e.stopPropagation();
								onStartEdit(item);
							}}
							class="rounded-md p-1 text-outline transition-colors hover:bg-surface-container-high hover:text-brand-navy"
						>
							<Pencil class="h-3.5 w-3.5" />
						</button>
					{/if}
				</div>
			{:else if allowCostEdit}
				<div class="mt-2 flex items-center gap-2 text-xs text-outline">
					<span>Sin costos registrados</span>
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation();
							onStartEdit(item);
						}}
						class="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-brand-blue transition-colors hover:bg-surface-container-high"
					>
						<Pencil class="h-3 w-3" />
						Agregar
					</button>
				</div>
			{/if}
		{/if}

		{#if isLens && editing}
			<div>
				<CostEditForm
					bind:editBaseCost
					bind:editMounting
					bind:editShipping
					bind:editShippingPending
					{saving}
					onSave={onSaveEdit}
					onCancel={onCancelEdit}
				/>
			</div>
		{/if}
	</div>

	<!-- USD / Bs. -->
	<div class="text-right">
		<span class="block text-sm font-semibold text-on-surface tabular-nums">
			{formatPrice(group.lineTotal)}
		</span>
		{#if item.itemType === SaleItemType.LENS_PAIR && item.shippingCostPending}
			<span
				class="mt-1 inline-flex items-center gap-1 rounded-full bg-warning-container px-2 py-0.5 text-[10px] font-semibold text-on-warning-container"
			>
				<Truck class="h-3 w-3" /> Envío pendiente
			</span>
		{/if}
	</div>
	<div class="text-right">
		{#if bsLineTotal !== null}
			<span class="block text-xs text-on-surface-variant tabular-nums">{bsLabel(bsLineTotal)}</span>
		{/if}
	</div>

	<!-- Expand chevron (lens rows only) -->
	<div class="flex justify-end pt-0.5">
		{#if showChevron}
			<button
				type="button"
				aria-label={expanded ? 'Ocultar la fórmula completa' : 'Ver la fórmula completa'}
				aria-expanded={expanded}
				onclick={() => onToggle()}
				class="grid h-[26px] w-[26px] place-items-center rounded-md text-on-surface-variant transition-[transform,background-color] duration-[250ms] ease-out hover:bg-surface-container-high {expanded
					? 'rotate-180'
					: ''}"
			>
				<ChevronDown class="h-4 w-4" />
			</button>
		{:else}
			<span></span>
		{/if}
	</div>
</div>

{#if hasRx}
	<div
		class="grid transition-[grid-template-rows] duration-300 ease-out {expanded
			? 'grid-rows-[1fr]'
			: 'grid-rows-[0fr]'}"
	>
		<div class="overflow-hidden">
			<LensRxPanel {item} />
		</div>
	</div>
{/if}
