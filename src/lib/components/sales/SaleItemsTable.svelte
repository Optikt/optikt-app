<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { FreeItemCategory, SaleItemType } from '$lib/shared/enums/lensTypes';
	import { updateItemCosts, enrichFreeItem } from '$lib/remote/sales.remote';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
	import { buildPersistedDisplayGroups } from './saleItemHelpers';
	import { checkHasAnyCost, computeInternalCostTotal } from './itemsTable/costTotals';
	import type { DisplayGroup } from './itemsTable/itemDisplay';
	import EnrichItemModal from './itemsTable/EnrichItemModal.svelte';
	import ItemsTableFooter from './itemsTable/ItemsTableFooter.svelte';
	import SaleItemsRow from './itemsTable/SaleItemsRow.svelte';

	interface Props {
		items: SaleItemWithDetails[];
		subtotal: number;
		discount?: number;
		discountType?: string;
		total?: number;
		allowCostEdit?: boolean;
		suppliers?: { id: string; name: string }[];
		onCostsUpdated?: () => void;
	}

	let {
		items,
		subtotal,
		discount = 0,
		discountType = 'FIXED',
		total,
		allowCostEdit = true,
		suppliers = [],
		onCostsUpdated
	}: Props = $props();

	// Edit state
	let editingItemId = $state<string | null>(null);
	let editBaseCost = $state(0);
	let editMounting = $state(0);
	let editShipping = $state(0);
	let editShippingPending = $state(false);
	let saving = $state(false);

	// Enrichment modal state
	let enrichingItemId = $state<string | null>(null);
	let enrichingCategory = $state<string | null>(null);
	let enrichUnitCost = $state<number | null>(null);
	let enrichOpticalNotes = $state('');
	let enrichSupplierId = $state<string>('');
	let enrichSaving = $state(false);
	let enrichIsReEnriching = $state(false);
	let enrichConfirming = $state(false);

	// Expanded prescription panels
	let expandedItems = new SvelteMap<string, boolean>();

	let supplierMap = $derived(new Map(suppliers.map((s) => [s.id, s.name])));

	let mainItems = $derived(items.filter((item) => item.itemType !== SaleItemType.TREATMENT));

	let displayGroups: DisplayGroup[] = $derived.by(() =>
		buildPersistedDisplayGroups(
			items,
			mainItems,
			SaleItemType.LENS_PAIR,
			SaleItemType.TREATMENT,
			(item) => item.parentSaleItemId
		)
	);

	let totalInternalCost = $derived(computeInternalCostTotal(displayGroups));
	let hasAnyCost = $derived(checkHasAnyCost(displayGroups));

	function toggleExpanded(key: string) {
		expandedItems.set(key, !expandedItems.get(key));
	}

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
				enrichingItemId = null;
				enrichingCategory = null;
				enrichSupplierId = '';
				enrichIsReEnriching = false;
				enrichConfirming = false;
				onCostsUpdated?.();
			} else {
				toast.error(result.error);
			}
		} catch {
			toast.error('Error al completar el ítem');
		} finally {
			enrichSaving = false;
		}
	}

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
		} catch {
			toast.error('Error al actualizar costos');
		} finally {
			saving = false;
		}
	}

	function handleRowKeydown(e: KeyboardEvent, key: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleExpanded(key);
		}
	}
</script>

<section class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
	<div class="flex items-center justify-between border-b border-gray-200 bg-gray-50/50 px-5 py-3.5">
		<h3 class="text-sm font-bold tracking-tight text-gray-800">Artículos y servicios</h3>
		<span
			class="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-400"
		>
			{displayGroups.length} item{displayGroups.length !== 1 ? 's' : ''}
		</span>
	</div>

	<div
		class="grid grid-cols-[3fr_1fr_1fr_1.2fr] gap-2 border-b border-gray-200 bg-gray-50/30 px-5 py-2.5 text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
	>
		<span>Producto</span>
		<span class="text-center">Cant.</span>
		<span class="text-right">Precio</span>
		<span class="text-right">Total</span>
	</div>

	<div class="divide-y divide-gray-100">
		{#each displayGroups as group (group.key)}
			<SaleItemsRow
				{group}
				expanded={expandedItems.get(group.key) ?? false}
				editing={editingItemId === group.item.id}
				{allowCostEdit}
				{supplierMap}
				bind:editBaseCost
				bind:editMounting
				bind:editShipping
				bind:editShippingPending
				{saving}
				onToggle={() => toggleExpanded(group.key)}
				onKeydown={(e) => handleRowKeydown(e, group.key)}
				onStartEnrich={startEnrich}
				onStartEdit={startEdit}
				onSaveEdit={saveEdit}
				onCancelEdit={cancelEdit}
			/>
		{/each}
	</div>

	<ItemsTableFooter
		{subtotal}
		{discount}
		{discountType}
		{total}
		{hasAnyCost}
		{totalInternalCost}
	/>
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
