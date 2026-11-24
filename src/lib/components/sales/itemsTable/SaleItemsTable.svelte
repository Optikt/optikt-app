<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { SaleItemType, FreeItemCategory } from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';
	import { logger } from '$lib/utils/logger';
	import { updateItemCosts, enrichFreeItem } from '$lib/remote/sales/items.remote';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
	import DocumentChildRow from '$lib/components/commercialDocument/DocumentChildRow.svelte';
	import type { DocumentChildView } from '$lib/components/commercialDocument/itemView';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { buildPersistedDisplayGroups } from '../helpers/items';
	import { treatmentChildDisplay } from '../editSaleDraft';
	import { checkHasAnyCost, computeInternalCostTotal, computeGrossMargin } from './costTotals';
	import type { DisplayGroup } from './itemDisplay';
	import EnrichItemModal from './EnrichItemModal.svelte';
	import SaleItemsRow from './SaleItemsRow.svelte';
	import type { Snippet } from 'svelte';
	import { Users } from '@lucide/svelte';
	import ItemPersonBadge from '../groups/ItemPersonBadge.svelte';
	import PersonsView from '../groups/PersonsView.svelte';
	import { orderByPerson } from '../groups/detailGroups';
	import { rowTintForItem, type GroupItemView } from '../groups/groupsState';
	import type { ItemGroup } from '$lib/shared/saleItemGroups';

	interface Props {
		items: SaleItemWithDetails[];
		/** Tax-exclusive net subtotal (after discounts) — margin base when the costs switch is on. */
		subtotalNet: number;
		allowCostEdit?: boolean;
		suppliers?: { id: string; name: string }[];
		/** Resolved BCV rate for the Bs. column; null hides it. */
		bsRate: number | null;
		bsApproximate: boolean;
		onCostsUpdated?: () => void;
		/** Grupos precomputados (adapter de presupuestos); por defecto se agrupan aquí. */
		groups?: DisplayGroup[];
		/** Badge extra junto al título (presupuesto convertido: "Solo lectura…"). */
		headerBadge?: Snippet;
		/** Título de la sección ("Artículos y servicios"). */
		sectionTitle?: string;
		/** Per-person grouping (chip per line, Lista | Por persona, Organizar). */
		persons?: {
			items: GroupItemView[];
			groups: ItemGroup[];
			primaryLensItemId?: string | null;
			docLabel?: string;
			onOrganize?: () => void;
		};
	}

	let {
		items,
		subtotalNet,
		allowCostEdit = true,
		suppliers = [],
		bsRate,
		bsApproximate,
		onCostsUpdated,
		groups: groupsProp,
		headerBadge,
		sectionTitle = 'Artículos y servicios',
		persons
	}: Props = $props();

	let personView = $state<'list' | 'people'>('list');
	const hasGroups = $derived((persons?.groups.length ?? 0) > 0);

	// ── Cost editing (lens rows) ──────────────────────────────────────────
	let editingItemId = $state<string | null>(null);
	let editBaseCost = $state(0);
	let editMounting = $state(0);
	let editShipping = $state(0);
	let editShippingPending = $state(false);
	let saving = $state(false);

	// ── Enrichment modal (free items) ─────────────────────────────────────
	let enrichingItemId = $state<string | null>(null);
	let enrichingCategory = $state<string | null>(null);
	let enrichUnitCost = $state<number | null>(null);
	let enrichOpticalNotes = $state('');
	let enrichSupplierId = $state<string>('');
	let enrichSaving = $state(false);
	let enrichIsReEnriching = $state(false);
	let enrichConfirming = $state(false);

	// ── Expanded prescription panels ──────────────────────────────────────
	const expandedItems = new SvelteMap<string, boolean>();

	/** "Costos internos" switch — off by default (not client-facing info). */
	let showCosts = $state(false);

	const mainItems = $derived(items.filter((item) => item.itemType !== SaleItemType.TREATMENT));

	const baseGroups: DisplayGroup[] = $derived(
		groupsProp ??
			buildPersistedDisplayGroups(
				items,
				mainItems,
				SaleItemType.LENS_PAIR,
				SaleItemType.TREATMENT,
				(item) => item.parentSaleItemId
			)
	);
	/** Same order as the ticket/PDF: by person (montura, cristal, …); identity without groups. */
	const displayGroups: DisplayGroup[] = $derived(
		persons
			? orderByPerson(baseGroups, (g) => g.item.id, persons.items, persons.groups)
			: baseGroups
	);

	const totalInternalCost = $derived(computeInternalCostTotal(displayGroups));
	const hasAnyCost = $derived(checkHasAnyCost(displayGroups));
	const margin = $derived(computeGrossMargin(subtotalNet, totalInternalCost));

	function toggleExpanded(key: string) {
		expandedItems.set(key, !expandedItems.get(key));
	}

	function handleRowKeydown(e: KeyboardEvent, key: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleExpanded(key);
		}
	}

	// ── Enrichment modal flow ─────────────────────────────────────────────
	function startEnrich(item: SaleItemWithDetails, isReEnriching = false) {
		enrichingItemId = item.id;
		enrichingCategory = item.freeDetails?.category ?? null;
		enrichUnitCost = item.freeDetails?.unitCost ?? null;
		enrichOpticalNotes = item.freeDetails?.opticalNotes ?? '';
		enrichSupplierId = item.freeDetails?.supplierId ?? '';
		enrichIsReEnriching = isReEnriching;
		enrichConfirming = false;
	}

	function cancelEnrich() {
		enrichingItemId = null;
		enrichingCategory = null;
		enrichSupplierId = '';
		enrichIsReEnriching = false;
		enrichConfirming = false;
	}

	function backFromConfirmation() {
		enrichConfirming = false;
	}

	async function saveEnrich() {
		if (!enrichingItemId || !enrichingCategory) return;
		const isService = enrichingCategory === FreeItemCategory.SERVICE;
		if (enrichUnitCost == null || (!isService && enrichUnitCost <= 0)) {
			toast.error('El costo real debe ser mayor a 0');
			return;
		}
		if (enrichIsReEnriching && !enrichConfirming) {
			enrichConfirming = true;
			return;
		}
		enrichSaving = true;
		try {
			const result = await enrichFreeItem({
				saleItemId: enrichingItemId,
				category: enrichingCategory,
				unitCost: enrichUnitCost,
				supplierId: enrichSupplierId || undefined,
				opticalNotes: enrichOpticalNotes || undefined
			});
			if (result.success) {
				toast.success(
					enrichIsReEnriching ? 'Ítem actualizado correctamente' : 'Ítem completado correctamente'
				);
				cancelEnrich();
				onCostsUpdated?.();
			} else {
				toast.error(result.error);
			}
		} catch (error) {
			logger.error('Error al completar el ítem', error);
			toast.error('Error al completar el ítem');
		} finally {
			enrichSaving = false;
		}
	}

	// ── Cost editing flow ─────────────────────────────────────────────────
	function startEdit(item: SaleItemWithDetails) {
		if (!allowCostEdit) return;

		editingItemId = item.id;
		editBaseCost = item.snapshotBaseCost ?? 0;
		editMounting = item.snapshotMountingPrice ?? 0;
		editShipping = item.snapshotShippingPrice ?? 0;
		editShippingPending = item.shippingCostPending ?? false;
	}

	function cancelEdit() {
		editingItemId = null;
	}

	async function saveEdit() {
		if (!editingItemId) return;
		saving = true;
		try {
			const result = await updateItemCosts({
				saleItemId: editingItemId,
				snapshotBaseCost: editBaseCost,
				snapshotMountingPrice: editMounting,
				snapshotShippingPrice: editShippingPending ? null : editShipping,
				shippingCostPending: editShippingPending
			});
			if (result.success) {
				toast.success('Costos actualizados');
				editingItemId = null;
				onCostsUpdated?.();
			} else {
				toast.error(result.error);
			}
		} catch (error) {
			logger.error('Error al actualizar costos', error);
			toast.error('Error al actualizar costos');
		} finally {
			saving = false;
		}
	}

	// ── Treatment children view-model (drawer parity) ─────────────────────
	function childView(treatment: SaleItemWithDetails): DocumentChildView | null {
		const display = treatmentChildDisplay(treatment);
		if (display.perEyeSalePrice <= 0) return null;
		const isAr = treatment.snapshotTreatmentCategory?.toUpperCase() === 'AR';
		return {
			key: treatment.id,
			title: treatment.snapshotName ?? 'Tratamiento',
			kind: 'treatment',
			tag: isAr ? 'Antirreflejo' : 'Adicional',
			quantity: display.eyes,
			unitPrice: display.perEyeSalePrice,
			unitPriceLabel: `${formatPrice(display.perEyeSalePrice)} c/u`
		};
	}
</script>

{#snippet costsSwitch({ props }: { props: Record<string, unknown> })}
	<button
		{...props}
		type="button"
		role="switch"
		aria-checked={showCosts}
		onclick={() => (showCosts = !showCosts)}
		class="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-on-surface-variant transition-colors hover:text-on-surface"
	>
		<span
			class="relative h-[18px] w-[30px] rounded-full transition-colors duration-200 {showCosts
				? 'bg-brand-blue'
				: 'bg-outline-variant'}"
		>
			<span
				class="absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 {showCosts
					? 'translate-x-[12px]'
					: ''}"
			></span>
		</span>
		Costos internos
	</button>
{/snippet}

<section
	class="items-section overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm"
>
	<div class="flex items-center gap-3 px-4 pt-3.5 pb-3">
		<h2 class="font-heading text-[15px] font-bold text-brand-navy">{sectionTitle}</h2>
		<span class="rounded bg-brand-navy px-[7px] text-[12px] font-bold text-white tabular-nums">
			{displayGroups.length}
		</span>
		{#if headerBadge}
			{@render headerBadge()}
		{/if}
		{#if persons && hasGroups}
			<div
				role="tablist"
				aria-label="Vista de artículos"
				class="inline-flex rounded-md bg-surface-container-high p-0.5"
			>
				{#each [{ v: 'list', l: 'Lista' }, { v: 'people', l: 'Por persona' }] as opt (opt.v)}
					<button
						type="button"
						role="tab"
						aria-selected={personView === opt.v}
						onclick={() => (personView = opt.v as 'list' | 'people')}
						class="min-h-8 rounded px-2.5 text-xs font-semibold {personView === opt.v
							? 'bg-white text-brand-navy shadow-sm'
							: 'text-on-surface-variant'}">{opt.l}</button
					>
				{/each}
			</div>
		{/if}
		{#if persons?.onOrganize}
			<button
				type="button"
				onclick={persons.onOrganize}
				class="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-brand-navy px-2.5 text-xs font-semibold text-brand-navy hover:bg-surface-container-low"
			>
				<Users class="h-3.5 w-3.5" /> Organizar
			</button>
		{/if}
		<span class="flex-1"></span>
		<TriggerTooltip
			trigger={costsSwitch}
			text="Muestra costos internos y márgenes. No es información para el cliente."
		/>
	</div>

	{#if persons && hasGroups && personView === 'people'}
		<PersonsView
			{displayGroups}
			items={persons.items}
			groups={persons.groups}
			primaryLensItemId={persons.primaryLensItemId}
			docLabel={persons.docLabel}
		/>
	{:else}
		<!-- Column header -->
		<div
			class="items-header grid grid-cols-[32px_1fr_104px_128px_26px] gap-3 border-t border-outline-variant/60 px-4 py-1.5 text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase"
		>
			<span></span>
			<span>Artículo</span>
			<span class="text-right">USD</span>
			<span class="text-right">Bs.</span>
			<span></span>
		</div>

		<!-- Rows -->
		{#if displayGroups.length === 0}
			<p
				class="border-t border-outline-variant/60 px-4 py-9 text-center text-[13px] text-on-surface-variant italic"
			>
				Esta venta no tiene artículos
			</p>
		{:else}
			{#each displayGroups as group (group.key)}
				{@const personViewItem = persons?.items.find((v) => v.id === group.item.id)}
				<SaleItemsRow
					{group}
					expanded={expandedItems.get(group.key) ?? false}
					editing={editingItemId === group.item.id}
					{allowCostEdit}
					{showCosts}
					{bsRate}
					{bsApproximate}
					bind:editBaseCost
					bind:editMounting
					bind:editShipping
					bind:editShippingPending
					{saving}
					rowTint={persons && hasGroups ? rowTintForItem(personViewItem, persons.groups) : null}
					onToggle={() => toggleExpanded(group.key)}
					onKeydown={(e) => handleRowKeydown(e, group.key)}
					onStartEnrich={startEnrich}
					onStartEdit={startEdit}
					onSaveEdit={saveEdit}
					onCancelEdit={cancelEdit}
				>
					{#snippet person()}
						{#if persons && hasGroups && personViewItem}
							<ItemPersonBadge
								item={personViewItem}
								groups={persons.groups}
								isPrimary={persons.primaryLensItemId === group.item.id}
								docLabel={persons.docLabel}
							/>
						{:else if persons?.primaryLensItemId === group.item.id && displayGroups.filter((g) => g.item.itemType === SaleItemType.LENS_PAIR).length > 1}
							<span
								class="mt-1 inline-block rounded bg-[#fff4c2] px-2 py-0.5 text-[11px] font-bold text-[#6f5900]"
								>★ FÓRMULA DEL CLIENTE</span
							>
						{/if}
					{/snippet}
				</SaleItemsRow>

				<!-- Treatment children (tree connector, drawer parity) -->
				{#each group.treatments as treatment, childIndex (treatment.id)}
					{@const vm = childView(treatment)}
					{#if vm}
						<DocumentChildRow
							child={vm}
							last={childIndex === group.treatments.length - 1}
							tooltip="Ver la fórmula del cristal"
							onOpen={() => toggleExpanded(group.key)}
						/>
					{/if}
				{/each}
			{/each}
		{/if}
	{/if}

	<!-- Costs footer (only with the switch on) -->
	{#if showCosts && hasAnyCost}
		<div
			class="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/60 px-4 py-2.5 text-[13px] text-on-surface-variant"
		>
			<span>
				Costo interno total
				<b class="font-semibold text-on-surface">{formatPrice(totalInternalCost)}</b>
			</span>
			<span>
				Margen bruto
				<b class="font-semibold text-on-surface">
					{formatPrice(margin.amount)}{margin.percent !== null
						? ` (${Math.round(margin.percent)}%)`
						: ''}
				</b>
			</span>
		</div>
	{/if}
</section>

{#if enrichingItemId}
	<EnrichItemModal
		isReEnriching={enrichIsReEnriching}
		confirming={enrichConfirming}
		bind:unitCost={enrichUnitCost}
		bind:supplierId={enrichSupplierId}
		bind:opticalNotes={enrichOpticalNotes}
		saving={enrichSaving}
		category={enrichingCategory}
		{suppliers}
		onBack={backFromConfirmation}
		onCancel={cancelEnrich}
		onSave={saveEnrich}
	/>
{/if}

<style>
	/* Móvil <700 (contenedor de página): filas como tarjetas sin header de
	   columnas; hijos con sangría 36. El layout de tarjeta vive en SaleItemsRow. */
	@container (max-width: 699px) {
		.items-section .items-header {
			display: none;
		}
		.items-section :global(.child-connector) {
			margin-left: 36px;
		}
	}
</style>
