<script lang="ts">
	import { Check, Eye, FlaskConical, Package, Pencil, Sparkles, Truck, X } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { DiscountType, getTreatmentCategoryLabel } from '$lib/shared/enums';
	import {
		SaleItemType,
		FreeItemCategory,
		FreeItemEnrichmentStatus
	} from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';
	import { updateItemCosts, enrichFreeItem } from '$lib/remote/sales.remote';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
	import { hasPrescriptionSnapshot } from '$lib/shared/prescriptionSnapshot';
	import { buildPersistedDisplayGroups } from './saleItemHelpers';

	interface DisplayGroup {
		key: string;
		item: SaleItemWithDetails;
		quantity: number;
		discountAmount: number;
		lineTotal: number;
		treatments: SaleItemWithDetails[];
	}

	interface Props {
		items: SaleItemWithDetails[];
		subtotal: number;
		allowCostEdit?: boolean;
		suppliers?: { id: string; name: string }[];
		onCostsUpdated?: () => void;
	}

	let { items, subtotal, allowCostEdit = true, suppliers = [], onCostsUpdated }: Props = $props();

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

	function toggleExpanded(key: string) {
		expandedItems.set(key, !expandedItems.get(key));
	}

	function isExpanded(key: string): boolean {
		return expandedItems.get(key) ?? false;
	}

	function itemLabel(group: DisplayGroup): string {
		if (group.item.itemType === SaleItemType.FREE_ITEM) {
			return group.item.freeDetails?.description ?? 'Ítem libre';
		}
		return (
			group.item.snapshotName ??
			group.item.product?.name ??
			group.item.lensCatalogItem?.name ??
			'Item sin nombre'
		);
	}

	function splitItemName(group: DisplayGroup): { principal: string; details: string } {
		const name = itemLabel(group);
		const parts = name.split('·').map((s) => s.trim());
		if (parts.length > 1) {
			return { principal: parts[0], details: parts.slice(1).join(' · ') };
		}
		const sku = group.item.snapshotSku ?? group.item.product?.sku;
		if (sku) {
			return { principal: name, details: sku };
		}
		return { principal: name, details: '' };
	}

	function itemBadge(itemType: string): { label: string; classes: string } {
		if (itemType === SaleItemType.LENS_PAIR) {
			return {
				label: 'CRISTAL',
				classes: 'text-amber-700 bg-amber-100 border-amber-200'
			};
		}
		if (itemType === SaleItemType.FREE_ITEM) {
			return {
				label: 'ÍTEM LIBRE',
				classes: 'text-gray-600 bg-gray-100 border-gray-200'
			};
		}
		return {
			label: 'MONTURA',
			classes: 'text-indigo-700 bg-indigo-50 border-indigo-100'
		};
	}

	function iconContainerClasses(itemType: string): string {
		if (itemType === SaleItemType.LENS_PAIR) {
			return 'bg-amber-100 border-amber-200 text-amber-700';
		}
		if (itemType === SaleItemType.FREE_ITEM) {
			return 'bg-gray-100 border-gray-200 text-gray-500';
		}
		return 'bg-indigo-50 border-indigo-100 text-indigo-600';
	}

	function rowHoverClasses(itemType: string): string {
		if (itemType === SaleItemType.LENS_PAIR) return 'hover:bg-amber-50/30';
		return 'hover:bg-gray-50/50';
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
		} catch (err) {
			console.error(err);
			toast.error('Error al completar el ítem');
		} finally {
			enrichSaving = false;
		}
	}

	let totalInternalCost = $derived.by(() => {
		let total = 0;
		for (const group of displayGroups) {
			if (group.item.itemType === SaleItemType.FREE_ITEM) {
				if (group.item.freeDetails?.enrichmentStatus === FreeItemEnrichmentStatus.ENRICHED) {
					total += (group.item.freeDetails.unitCost ?? 0) * group.quantity;
				}
			} else if (group.item.snapshotCostTotal != null) {
				total += group.item.snapshotCostTotal;
			} else if (group.item.itemType === SaleItemType.LENS_PAIR) {
				const base = group.item.snapshotBaseCost ?? 0;
				const mounting = group.item.snapshotMountingPrice ?? 0;
				const shipping = group.item.shippingCostPending
					? 0
					: (group.item.snapshotShippingPrice ?? 0);
				total += base + mounting + shipping;
			} else if (group.item.snapshotCostUnit != null) {
				total += group.item.snapshotCostUnit * group.quantity;
			}
		}
		return total;
	});

	let hasAnyCost = $derived(
		displayGroups.some(
			(g) =>
				g.item.snapshotCostTotal != null ||
				g.item.snapshotBaseCost != null ||
				g.item.snapshotMountingPrice != null ||
				g.item.snapshotShippingPrice != null ||
				g.item.snapshotCostUnit != null ||
				(g.item.itemType === SaleItemType.FREE_ITEM &&
					g.item.freeDetails?.enrichmentStatus === FreeItemEnrichmentStatus.ENRICHED)
		)
	);

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
		} catch (err) {
			console.error(err);
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

	function prescriptionValue(val: number | null | undefined): string {
		return val != null ? String(val) : '—';
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
		class="grid grid-cols-[1fr_70px_110px_130px] gap-2 border-b border-gray-200 bg-gray-50/30 px-5 py-2.5 text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
	>
		<span>Producto</span>
		<span class="text-center">Cant.</span>
		<span class="text-right">Precio</span>
		<span class="text-right">Total</span>
	</div>

	<div class="divide-y divide-gray-100">
		{#each displayGroups as group (group.key)}
			{@const isLens = group.item.itemType === SaleItemType.LENS_PAIR}
			{@const hasRx = isLens && hasPrescriptionSnapshot(group.item)}
			{@const badge = itemBadge(group.item.itemType)}
			{@const iconCls = iconContainerClasses(group.item.itemType)}
			{@const hoverCls = rowHoverClasses(group.item.itemType)}
			{@const nameParts = splitItemName(group)}
			<div>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div
					class="grid grid-cols-[1fr_70px_110px_130px] items-center gap-2 px-5 py-4 {hasRx
						? `cursor-pointer ${hoverCls} transition-colors`
						: hoverCls}"
					onclick={hasRx ? () => toggleExpanded(group.key) : undefined}
					role={hasRx ? 'button' : undefined}
					tabindex={hasRx ? 0 : undefined}
					onkeydown={hasRx ? (e) => handleRowKeydown(e, group.key) : undefined}
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
										<p class="mt-0.5 text-on-surface-variant">
											Costo y proveedor no registrados aún
										</p>
										{#if allowCostEdit}
											<button
												type="button"
												onclick={() => startEnrich(group.item)}
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
													onclick={() => startEnrich(group.item, true)}
													class="inline-flex items-center gap-1 rounded-lg bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-highest"
												>
													<Pencil size={11} />
													Editar
												</button>
											{/if}
										</div>
										{#if fd.unitCost != null}
											<p>
												Costo: <span class="font-mono font-semibold"
													>{formatPrice(fd.unitCost)}</span
												>
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
								{#if editingItemId === group.item.id}
									<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
										<label class="flex items-center gap-1">
											<span class="text-on-surface-variant">Cristales:</span>
											<input
												type="number"
												step="0.01"
												min="0"
												bind:value={editBaseCost}
												class="w-20 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
											/>
										</label>
										<label class="flex items-center gap-1">
											<span class="text-on-surface-variant">Montaje:</span>
											<input
												type="number"
												step="0.01"
												min="0"
												bind:value={editMounting}
												class="w-20 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
											/>
										</label>
										{#if !editShippingPending}
											<label class="flex items-center gap-1">
												<span class="text-on-surface-variant">Envío:</span>
												<input
													type="number"
													step="0.01"
													min="0"
													bind:value={editShipping}
													class="w-20 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
												/>
											</label>
										{/if}
										<label class="flex items-center gap-1.5 text-on-surface-variant">
											<input
												type="checkbox"
												bind:checked={editShippingPending}
												class="h-3.5 w-3.5 rounded border-outline-variant accent-brand-blue"
											/>
											Envío pendiente
										</label>
										<div class="flex items-center gap-1">
											<button
												type="button"
												onclick={saveEdit}
												disabled={saving}
												class="inline-flex items-center justify-center rounded-md bg-brand-blue p-1.5 text-white transition-colors hover:bg-brand-blue/80 disabled:opacity-50"
												title="Guardar"
											>
												<Check class="h-3.5 w-3.5" />
											</button>
											<button
												type="button"
												onclick={cancelEdit}
												disabled={saving}
												class="inline-flex items-center justify-center rounded-md bg-surface-container-high p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest disabled:opacity-50"
												title="Cancelar"
											>
												<X class="h-3.5 w-3.5" />
											</button>
										</div>
									</div>
								{:else}
									{@const baseCost = group.item.snapshotBaseCost ?? 0}
									{@const mounting = group.item.snapshotMountingPrice ?? 0}
									{@const shipping = group.item.snapshotShippingPrice ?? 0}
									{@const isPending = group.item.shippingCostPending ?? false}
									{@const costTotal =
										group.item.snapshotCostTotal ??
										baseCost + mounting + (isPending ? 0 : shipping)}
									<div
										class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant"
									>
										<span
											>Cristales: <span class="font-mono text-brand-navy"
												>{formatPrice(baseCost)}</span
											></span
										>
										{#if mounting > 0}
											<span
												>Montaje: <span class="font-mono text-brand-navy"
													>{formatPrice(mounting)}</span
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
												>Envío: <span class="font-mono text-brand-navy"
													>{formatPrice(shipping)}</span
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
												onclick={() => startEdit(group.item)}
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
											onclick={() => startEdit(group.item)}
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
									class:rotate-180={isExpanded(group.key)}
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
						class:max-h-[500px]={isExpanded(group.key)}
						class:opacity-100={isExpanded(group.key)}
						class:max-h-0={!isExpanded(group.key)}
						class:opacity-0={!isExpanded(group.key)}
					>
						<div class="px-5 pb-4">
							<div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
								<div class="mb-3 flex items-center gap-2">
									<div class="flex h-5 w-5 items-center justify-center rounded bg-slate-200">
										<svg
											class="h-3 w-3 text-slate-600"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
									</div>
									<span class="text-xs font-bold tracking-widest text-slate-600 uppercase"
										>Prescripción</span
									>
								</div>

								<div class="grid grid-cols-[40px_repeat(5,minmax(50px,1fr))] gap-x-3 gap-y-2">
									<div></div>
									<span class="text-center text-[10px] font-bold text-slate-500">ESF</span>
									<span class="text-center text-[10px] font-bold text-slate-500">CIL</span>
									<span class="text-center text-[10px] font-bold text-slate-500">EJE</span>
									<span class="text-center text-[10px] font-bold text-slate-500">ADD</span>
									<span class="text-center text-[10px] font-bold text-slate-500">DIP</span>

									<div class="flex items-center gap-1.5">
										<span class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500"></span>
										<span class="text-[11px] font-bold text-slate-600">OI</span>
									</div>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>{prescriptionValue(group.item.osSphere)}</span
									>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>{prescriptionValue(group.item.osCylinder)}</span
									>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>{prescriptionValue(group.item.osAxis)}</span
									>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>{prescriptionValue(group.item.osAddition)}</span
									>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>—</span
									>

									<div class="flex items-center gap-1.5">
										<span class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500"></span>
										<span class="text-[11px] font-bold text-slate-600">OD</span>
									</div>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>{prescriptionValue(group.item.odSphere)}</span
									>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>{prescriptionValue(group.item.odCylinder)}</span
									>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>{prescriptionValue(group.item.odAxis)}</span
									>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>{prescriptionValue(group.item.odAddition)}</span
									>
									<span
										class="text-center font-mono text-sm font-semibold whitespace-nowrap text-slate-800"
										>—</span
									>
								</div>

								<div class="mt-3 flex gap-6 border-t border-slate-200 pt-3 text-[11px]">
									<span class="text-slate-500"
										>Alt. Montaje OI: <strong class="font-mono text-slate-800">—</strong></span
									>
									<span class="text-slate-500"
										>Alt. Montaje OD: <strong class="font-mono text-slate-800">—</strong></span
									>
								</div>
							</div>
						</div>
					</div>
				{/if}

				{#each group.treatments as treatment (treatment.id)}
					<div
						class="grid grid-cols-[1fr_70px_110px_130px] items-center gap-2 px-5 py-4 transition-colors hover:bg-gray-50/50"
					>
						<div class="flex min-w-0 items-center gap-3">
							<div
								class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-purple-100 bg-purple-50"
							>
								<FlaskConical class="h-4 w-4 text-purple-600" />
							</div>
							<div class="min-w-0">
								<p class="truncate text-sm font-semibold text-gray-900">
									{treatment.supplierTreatment?.name ?? 'Tratamiento'}
								</p>
								<div class="mt-0.5 flex flex-wrap items-center gap-1.5">
									<span
										class="inline-flex items-center rounded border border-purple-100 bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-purple-700 uppercase"
									>
										Tratamiento
									</span>
									{#if treatment.supplierTreatment?.category}
										<span class="text-xs text-gray-400">
											{getTreatmentCategoryLabel(treatment.supplierTreatment.category)}
										</span>
									{/if}
								</div>
							</div>
						</div>
						<span class="text-center text-sm font-medium text-gray-700">{treatment.quantity}</span>
						<span class="text-right text-sm text-gray-500">{formatPrice(treatment.unitPrice)}</span>
						<span class="text-right text-sm font-bold text-gray-900"
							>{formatPrice(treatment.unitPrice * treatment.quantity)}</span
						>
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<div class="border-t border-gray-200 bg-gray-50/50 px-5 py-4">
		{#if hasAnyCost}
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium tracking-wider text-gray-400 uppercase">
					Costo interno total
				</span>
				<span class="text-xs font-medium text-gray-500">
					{formatPrice(totalInternalCost)}
				</span>
			</div>
			<div class="mt-2 border-t border-gray-200 pt-2"></div>
		{/if}
		<div class="flex items-center justify-between">
			<span class="text-sm font-bold text-gray-700">Subtotal general</span>
			<span class="text-base font-bold text-gray-900">{formatPrice(subtotal)}</span>
		</div>
	</div>
</section>

{#if enrichingItemId}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
			<h3 class="mb-4 text-lg font-semibold text-brand-navy">
				{enrichIsReEnriching ? 'Editar ítem libre' : 'Completar ítem libre'}
			</h3>

			{#if enrichConfirming}
				<div class="rounded-xl bg-warning-container/60 px-4 py-3 text-sm text-on-warning-container">
					<p class="font-semibold">⚠ Confirmar cambios</p>
					<p class="mt-1 text-xs">
						Este ítem ya fue completado. ¿Guardar los cambios y sobreescribir los datos anteriores?
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#if enrichIsReEnriching}
						<p
							class="rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant"
						>
							Editando un ítem ya completado. Los cambios sobreescribirán los valores anteriores.
						</p>
					{/if}
					<div>
						<label
							for="enrich-unit-cost"
							class="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
						>
							Costo real (USD) *
						</label>
						<input
							id="enrich-unit-cost"
							type="number"
							bind:value={enrichUnitCost}
							step="0.01"
							min="0.01"
							class="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
							placeholder="0.00"
						/>
					</div>

					{#if suppliers.length > 0}
						<div>
							<label
								for="enrich-supplier-id"
								class="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
							>
								Proveedor
							</label>
							<select
								id="enrich-supplier-id"
								bind:value={enrichSupplierId}
								class="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
							>
								<option value="">Sin proveedor</option>
								{#each suppliers as supplier (supplier.id)}
									<option value={supplier.id}>{supplier.name}</option>
								{/each}
							</select>
						</div>
					{/if}

					<div>
						<label
							for="enrich-optical-notes"
							class="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
						>
							Notas ópticas
						</label>
						<input
							id="enrich-optical-notes"
							type="text"
							bind:value={enrichOpticalNotes}
							maxlength={1000}
							class="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 focus:outline-none"
							placeholder="OD -2.50 sph, color miel..."
						/>
					</div>
				</div>
			{/if}

			<div class="mt-6 flex justify-end gap-3">
				<button
					type="button"
					onclick={enrichConfirming ? backFromConfirmation : cancelEnrich}
					class="rounded-xl px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low"
				>
					{enrichConfirming ? 'Volver' : 'Cancelar'}
				</button>
				<button
					type="button"
					onclick={saveEnrich}
					disabled={enrichSaving ||
						(!enrichConfirming &&
							(enrichUnitCost == null ||
								(enrichingCategory !== FreeItemCategory.SERVICE && enrichUnitCost <= 0)))}
					class="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 {enrichConfirming
						? 'bg-error hover:bg-error/90'
						: 'bg-amber-600 hover:bg-amber-700'}"
				>
					{enrichSaving
						? 'Guardando...'
						: enrichConfirming
							? 'Confirmar cambios'
							: enrichIsReEnriching
								? 'Guardar cambios'
								: 'Guardar'}
				</button>
			</div>
		</div>
	</div>
{/if}
