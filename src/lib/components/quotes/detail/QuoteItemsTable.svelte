<script lang="ts">
	import { ClipboardList, Eye, FlaskConical, Package, Sparkles } from '@lucide/svelte';
	import { DiscountType, getTreatmentCategoryLabel } from '$lib/shared/enums';
	import { SaleItemType, getFreeItemCategoryLabel } from '$lib/shared/enums/lensTypes';
	import { formatPrice } from '$lib/utils';
	import { formatPrescriptionEye, hasPrescriptionSnapshot } from '$lib/shared/prescriptionSnapshot';
	import type { QuoteItemWithDetails } from '$lib/server/db/queries/quotes';

	export interface QuoteDisplayGroup {
		key: string;
		item: QuoteItemWithDetails;
		quantity: number;
		discountAmount: number;
		lineTotal: number;
		treatments: QuoteItemWithDetails[];
	}

	interface Props {
		groups: QuoteDisplayGroup[];
		quoteSubtotal: number;
	}

	let { groups, quoteSubtotal }: Props = $props();
</script>

<section class="glass-card overflow-hidden">
	<div
		class="flex flex-col gap-4 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
			>
				<ClipboardList class="h-5 w-5" />
			</div>
			<div>
				<h2 class="text-xl font-semibold text-brand-navy">Artículos y servicios</h2>
				<p class="text-sm text-on-surface-variant">
					{groups.length} línea{groups.length !== 1 ? 's' : ''} principal{groups.length !== 1
						? 'es'
						: ''}
				</p>
			</div>
		</div>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full text-sm">
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
				{#each groups as group (group.key)}
					{@const item = group.item}
					{@const odSummary = formatPrescriptionEye(item, 'od')}
					{@const osSummary = formatPrescriptionEye(item, 'os')}
					<tr
						class="bg-surface-container-lowest transition-colors hover:bg-surface-container-low/35"
					>
						<td class="px-6 py-5 align-top">
							<div class="flex items-start gap-4">
								<div
									class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {item.itemType ===
									SaleItemType.LENS_PAIR
										? 'bg-info-container text-on-info-container'
										: item.itemType === SaleItemType.FREE_ITEM
											? 'bg-amber-100 text-amber-600'
											: 'bg-surface-container-low text-on-surface-variant'}"
								>
									{#if item.itemType === SaleItemType.LENS_PAIR}
										<Eye class="h-5 w-5" />
									{:else if item.itemType === SaleItemType.FREE_ITEM}
										<Sparkles class="h-5 w-5" />
									{:else}
										<Package class="h-5 w-5" />
									{/if}
								</div>
								<div>
									<p class="text-lg leading-tight font-semibold text-brand-navy">
										{item.itemType === SaleItemType.FREE_ITEM
											? (item.freeDetails?.description ?? 'Ítem libre')
											: (item.snapshotName ??
												item.product?.name ??
												item.lensCatalogItem?.name ??
												'-')}
									</p>
									{#if item.itemType === SaleItemType.FREE_ITEM && item.freeDetails}
										<span
											class="mt-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700"
										>
											{getFreeItemCategoryLabel(item.freeDetails.category)}
										</span>
										{#if item.freeDetails.unitCost != null}
											<p class="mt-1 text-xs text-amber-600">
												Costo est.: {formatPrice(item.freeDetails.unitCost)}
											</p>
										{:else}
											<p class="mt-1 text-xs text-amber-500">Sin costo estimado</p>
										{/if}
									{:else}
										{#if item.snapshotSku}
											<span class="font-mono text-xs text-slate-400">{item.snapshotSku}</span>
										{/if}
										{#if item.snapshotBrand}
											<span
												class="ml-2 rounded bg-surface-container-low px-1.5 py-0.5 text-xs font-medium text-slate-600"
												>{item.snapshotBrand}</span
											>
										{/if}
										{#if item.itemType === SaleItemType.LENS_PAIR && hasPrescriptionSnapshot(item) && (odSummary || osSummary)}
											<div class="mt-2 space-y-1 text-xs text-on-surface-variant">
												{#if odSummary}
													<p class="font-mono">{odSummary}</p>
												{/if}
												{#if osSummary}
													<p class="font-mono">{osSummary}</p>
												{/if}
											</div>
										{/if}
									{/if}
								</div>
							</div>
						</td>
						<td class="px-6 py-5 align-top">
							<span
								class="inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] uppercase {item.itemType ===
								SaleItemType.LENS_PAIR
									? 'bg-info-container text-on-info-container'
									: item.itemType === SaleItemType.FREE_ITEM
										? 'bg-amber-100 text-amber-700'
										: 'bg-surface-container-high text-on-surface-variant'}"
							>
								{item.itemType === SaleItemType.LENS_PAIR
									? 'Cristal'
									: item.itemType === SaleItemType.FREE_ITEM
										? 'Ítem Libre'
										: 'Producto'}
							</span>
						</td>
						<td
							class="px-6 py-5 text-center align-top font-mono text-lg font-semibold text-brand-navy"
							>{group.quantity}</td
						>
						<td class="px-6 py-5 text-right align-top font-mono text-base text-on-surface-variant">
							{formatPrice(item.unitPrice)}
						</td>
						<td
							class="px-6 py-5 text-right align-top font-mono text-base {group.discountAmount > 0
								? 'text-error'
								: 'text-outline'}"
						>
							{#if group.discountAmount > 0}
								-{formatPrice(group.discountAmount)}
								{#if item.discountType === DiscountType.PERCENTAGE}
									<span class="text-xs text-outline">({item.discount}%)</span>
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
											{treatment.supplierTreatment?.name ?? treatment.snapshotName ?? 'Tratamiento'}
										</p>
										{#if treatment.snapshotTreatmentCategory}
											<p class="mt-1 text-xs text-outline">
												{getTreatmentCategoryLabel(treatment.snapshotTreatmentCategory)}
											</p>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-6 py-5 align-top">
								<span
									class="inline-flex rounded-full bg-purple-container px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-on-purple-container uppercase"
									>Tratamiento</span
								>
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
						{formatPrice(quoteSubtotal)}
					</td>
				</tr>
			</tfoot>
		</table>
	</div>
</section>
