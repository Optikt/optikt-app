<script lang="ts">
	import {
		Check,
		Eye,
		FlaskConical,
		Package,
		Pencil,
		ShoppingCart,
		Sparkles,
		Truck,
		X
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { DiscountType, getTreatmentCategoryLabel } from '$lib/shared/enums';
	import {
		SaleItemType,
		FreeItemCategory,
		FreeItemEnrichmentStatus,
		getFreeItemCategoryLabel
	} from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';
	import { updateItemCosts, enrichFreeItem } from '$lib/remote/sales.remote';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';
	import { formatPrescriptionEye, hasPrescriptionSnapshot } from '$lib/shared/prescriptionSnapshot';
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

	function itemTypeLabel(item: SaleItemWithDetails): string {
		if (item.itemType === SaleItemType.LENS_PAIR) return 'Cristal';
		if (item.itemType === SaleItemType.FREE_ITEM) return 'Ítem Libre';
		return 'Producto';
	}

	function itemTypeClasses(item: SaleItemWithDetails): string {
		if (item.itemType === SaleItemType.LENS_PAIR) {
			return 'bg-info-container text-on-info-container';
		}
		if (item.itemType === SaleItemType.FREE_ITEM) {
			return 'bg-amber-100 text-amber-700';
		}

		return 'bg-surface-container-high text-on-surface-variant';
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
		// Re-enriching requires an extra confirmation step
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

	// ── Total internal cost ──────────────────────────────────────────────
	// Use displayGroups so that lens pairs (OD + OI) are counted only once.
	// snapshotBaseCost = pairPurchasePrice is stored on each eye item, so
	// iterating raw items would double-count when both eyes are enabled.
	let totalInternalCost = $derived.by(() => {
		let total = 0;
		for (const group of displayGroups) {
			if (group.item.itemType === SaleItemType.FREE_ITEM) {
				// Only count enriched free items with known costs
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

	// ── Edit helpers ─────────────────────────────────────────────────────
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
</script>

<section class="glass-card overflow-hidden">
	<div
		class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
			>
				<ShoppingCart class="h-5 w-5" />
			</div>
			<div>
				<h2 class="text-xl font-semibold text-brand-navy">Artículos y servicios</h2>
				<p class="text-sm text-on-surface-variant">
					{displayGroups.length} línea{displayGroups.length !== 1 ? 's' : ''} principal{displayGroups.length !==
					1
						? 'es'
						: ''}
				</p>
			</div>
		</div>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full min-w-[880px] text-sm">
			<thead class="bg-surface-container-low text-left">
				<tr>
					<th class="px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Artículo</th
					>
					<th class="px-6 py-4 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Tipo</th
					>
					<th
						class="px-6 py-4 text-center text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Cant.</th
					>
					<th
						class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Precio unit.</th
					>
					<th
						class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Desc.</th
					>
					<th
						class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Subtotal</th
					>
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-container-low">
				{#each displayGroups as group (group.key)}
					{@const odSummary = formatPrescriptionEye(group.item, 'od')}
					{@const osSummary = formatPrescriptionEye(group.item, 'os')}
					<tr
						class="bg-surface-container-lowest transition-colors hover:bg-surface-container-low/35"
					>
						<td class="px-6 py-5 align-top">
							<div class="flex items-start gap-4">
								<div
									class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {group.item
										.itemType === SaleItemType.LENS_PAIR
										? 'bg-info-container text-on-info-container'
										: group.item.itemType === SaleItemType.FREE_ITEM
											? 'bg-amber-100 text-amber-600'
											: 'bg-surface-container-low text-on-surface-variant'}"
								>
									{#if group.item.itemType === SaleItemType.LENS_PAIR}
										<Eye class="h-5 w-5" />
									{:else if group.item.itemType === SaleItemType.FREE_ITEM}
										<Sparkles class="h-5 w-5" />
									{:else}
										<Package class="h-5 w-5" />
									{/if}
								</div>
								<div>
									<p class="text-lg leading-tight font-semibold text-brand-navy">
										{itemLabel(group)}
									</p>
									<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-outline">
										{#if group.item.itemType === SaleItemType.FREE_ITEM && group.item.freeDetails}
											<span
												class="rounded-full bg-surface-container-high px-2 py-0.5 font-semibold text-on-surface-variant"
											>
												{getFreeItemCategoryLabel(group.item.freeDetails.category)}
											</span>
										{:else}
											{#if group.item.snapshotSku ?? group.item.product?.sku}
												<span class="font-mono"
													>{group.item.snapshotSku ?? group.item.product?.sku}</span
												>
											{/if}
											{#if group.item.snapshotCostUnit != null}
												<span class="font-mono">
													Costo {formatPrice(group.item.snapshotCostUnit)}
													{#if group.item.snapshotLotsCount != null && group.item.snapshotLotsCount > 1}
														· {group.item.snapshotLotsCount} lotes
													{/if}
												</span>
											{/if}
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
									{#if group.item.itemType === SaleItemType.LENS_PAIR && hasPrescriptionSnapshot(group.item) && (odSummary || osSummary)}
										<div class="mt-2 space-y-1 text-xs text-on-surface-variant">
											{#if odSummary}
												<p class="font-mono">{odSummary}</p>
											{/if}
											{#if osSummary}
												<p class="font-mono">{osSummary}</p>
											{/if}
										</div>
									{/if}
									{#if group.item.itemType === SaleItemType.LENS_PAIR && (group.item.snapshotBaseCost != null || group.item.snapshotMountingPrice != null || group.item.snapshotShippingPrice != null)}
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
													>Total: <span class="font-mono text-brand-navy"
														>{formatPrice(costTotal)}</span
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
									{:else if group.item.itemType === SaleItemType.LENS_PAIR}
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
						</td>
						<td class="px-6 py-5 align-top">
							<span
								class="inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] uppercase {itemTypeClasses(
									group.item
								)}"
							>
								{itemTypeLabel(group.item)}
							</span>
						</td>
						<td
							class="px-6 py-5 text-center align-top font-mono text-lg font-semibold text-brand-navy"
							>{group.quantity}</td
						>
						<td class="px-6 py-5 text-right align-top font-mono text-base text-on-surface-variant">
							{formatPrice(group.item.unitPrice)}
						</td>
						<td
							class="px-6 py-5 text-right align-top font-mono text-base {group.discountAmount > 0
								? 'text-error'
								: 'text-outline'}"
						>
							{#if group.discountAmount > 0}
								-{formatPrice(group.discountAmount)}
								{#if group.item.discountType === DiscountType.PERCENTAGE}
									<span class="text-xs text-outline">({group.item.discount}%)</span>
								{/if}
							{:else}
								$0.00
							{/if}
						</td>
						<td class="px-6 py-5 text-right align-top font-mono text-lg font-bold text-brand-navy">
							{formatPrice(group.lineTotal)}
						</td>
					</tr>

					{#each group.treatments as treatment (treatment.id)}
						<tr
							class="bg-surface-container-lowest/80 transition-colors hover:bg-surface-container-low/35"
						>
							<td class="px-6 py-5 align-top">
								<div class="flex items-start gap-4">
									<div
										class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-container text-on-purple-container"
									>
										<FlaskConical class="h-5 w-5" />
									</div>
									<div>
										<p class="text-lg leading-tight font-semibold text-brand-navy">
											{treatment.supplierTreatment?.name ?? 'Tratamiento'}
										</p>
										{#if treatment.supplierTreatment?.category}
											<p class="mt-1 text-xs text-outline">
												{getTreatmentCategoryLabel(treatment.supplierTreatment.category)}
											</p>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-6 py-5 align-top">
								<span
									class="inline-flex rounded-full bg-purple-container px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-on-purple-container uppercase"
								>
									Tratamiento
								</span>
							</td>
							<td
								class="px-6 py-5 text-center align-top font-mono text-lg font-semibold text-brand-navy"
								>{treatment.quantity}</td
							>
							<td
								class="px-6 py-5 text-right align-top font-mono text-base text-on-surface-variant"
							>
								{formatPrice(treatment.unitPrice)}
							</td>
							<td class="px-6 py-5 text-right align-top font-mono text-base text-outline">$0.00</td>
							<td
								class="px-6 py-5 text-right align-top font-mono text-lg font-bold text-brand-navy"
							>
								{formatPrice(treatment.unitPrice * treatment.quantity)}
							</td>
						</tr>
					{/each}
				{/each}
			</tbody>
			<tfoot class="bg-surface-container-low/60">
				{#if hasAnyCost}
					<tr class="border-b border-surface-container-low">
						<td
							colspan="5"
							class="px-6 py-4 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>
							Costo interno total
						</td>
						<td
							class="px-6 py-4 text-right font-mono text-lg font-semibold text-on-surface-variant"
						>
							{formatPrice(totalInternalCost)}
						</td>
					</tr>
				{/if}
				<tr>
					<td
						colspan="5"
						class="px-6 py-5 text-right text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
					>
						Subtotal general
					</td>
					<td class="px-6 py-5 text-right font-mono text-2xl font-bold text-brand-navy">
						{formatPrice(subtotal)}
					</td>
				</tr>
			</tfoot>
		</table>
	</div>
</section>

{#if enrichingItemId}
	<!-- Enrich Free Item modal -->
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
							class="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
						>
							Costo real (USD) *
						</label>
						<input
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
								class="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
							>
								Proveedor
							</label>
							<select
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
							class="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-outline uppercase"
						>
							Notas ópticas
						</label>
						<input
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
