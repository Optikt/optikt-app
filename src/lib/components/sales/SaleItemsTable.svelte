<script lang="ts">
	import { Eye, FlaskConical, Package, ShoppingCart, Truck } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { DiscountType, getTreatmentCategoryLabel } from '$lib/shared/enums';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales';

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
	}

	let { items, subtotal }: Props = $props();

	let mainItems = $derived(items.filter((item) => item.itemType !== SaleItemType.TREATMENT));

	function getTreatments(parentId: string): SaleItemWithDetails[] {
		return items.filter(
			(item) => item.itemType === SaleItemType.TREATMENT && item.parentSaleItemId === parentId
		);
	}

	function itemDiscountAmount(item: SaleItemWithDetails): number {
		if (item.discountType === DiscountType.PERCENTAGE) {
			return (item.discount / 100) * item.unitPrice * item.quantity;
		}

		return item.discount;
	}

	let displayGroups: DisplayGroup[] = $derived.by(() => {
		const groups: DisplayGroup[] = [];
		const lensGroupMap = new SvelteMap<string, DisplayGroup>();

		for (const item of mainItems) {
			if (item.itemType === SaleItemType.LENS_PAIR && item.lensCatalogItemId) {
				const existing = lensGroupMap.get(item.lensCatalogItemId);
				if (existing) {
					existing.quantity += item.quantity;
					existing.discountAmount += itemDiscountAmount(item);
					existing.lineTotal += item.unitPrice * item.quantity - itemDiscountAmount(item);
					existing.treatments.push(...getTreatments(item.id));
				} else {
					const discountAmount = itemDiscountAmount(item);
					const group: DisplayGroup = {
						key: `lens-${item.lensCatalogItemId}`,
						item,
						quantity: item.quantity,
						discountAmount,
						lineTotal: item.unitPrice * item.quantity - discountAmount,
						treatments: [...getTreatments(item.id)]
					};

					lensGroupMap.set(item.lensCatalogItemId, group);
					groups.push(group);
				}
			} else {
				const discountAmount = itemDiscountAmount(item);
				groups.push({
					key: item.id,
					item,
					quantity: item.quantity,
					discountAmount,
					lineTotal: item.unitPrice * item.quantity - discountAmount,
					treatments: getTreatments(item.id)
				});
			}
		}

		return groups;
	});

	function itemLabel(group: DisplayGroup): string {
		return group.item.product?.name ?? group.item.lensCatalogItem?.name ?? 'Item sin nombre';
	}

	function itemTypeLabel(item: SaleItemWithDetails): string {
		if (item.itemType === SaleItemType.LENS_PAIR || item.lensCatalogItem) return 'Cristal';
		return 'Producto';
	}

	function itemTypeClasses(item: SaleItemWithDetails): string {
		if (item.itemType === SaleItemType.LENS_PAIR || item.lensCatalogItem) {
			return 'bg-info-container text-on-info-container';
		}

		return 'bg-surface-container-high text-on-surface-variant';
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
					<tr
						class="bg-surface-container-lowest transition-colors hover:bg-surface-container-low/35"
					>
						<td class="px-6 py-5 align-top">
							<div class="flex items-start gap-4">
								<div
									class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {group.item
										.lensCatalogItem
										? 'bg-info-container text-on-info-container'
										: 'bg-surface-container-low text-on-surface-variant'}"
								>
									{#if group.item.lensCatalogItem}
										<Eye class="h-5 w-5" />
									{:else}
										<Package class="h-5 w-5" />
									{/if}
								</div>
								<div>
									<p class="text-lg leading-tight font-semibold text-brand-navy">
										{itemLabel(group)}
									</p>
									<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-outline">
										{#if group.item.product?.sku}
											<span class="font-mono">{group.item.product.sku}</span>
										{/if}
										{#if group.item.snapshotCostUnit != null}
											<span class="font-mono">
												Costo {formatPrice(group.item.snapshotCostUnit)}
												{#if group.item.snapshotLotsCount != null && group.item.snapshotLotsCount > 1}
													· {group.item.snapshotLotsCount} lotes
												{/if}
											</span>
										{/if}
									</div>
									{#if group.item.itemType === SaleItemType.LENS_PAIR && (group.item.snapshotBaseCost != null || group.item.snapshotMountingPrice != null || group.item.snapshotShippingPrice != null)}
										{@const baseCost = group.item.snapshotBaseCost ?? 0}
										{@const mounting = group.item.snapshotMountingPrice ?? 0}
										{@const shipping = group.item.snapshotShippingPrice ?? 0}
										{@const isPending = group.item.shippingCostPending ?? false}
										{@const costTotal = baseCost + mounting + (isPending ? 0 : shipping)}
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
