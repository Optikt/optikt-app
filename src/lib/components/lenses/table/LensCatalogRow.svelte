<script lang="ts">
	import { Eye, SquarePen, Trash2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { LensCatalogSource, LensInventoryMode } from '$lib/shared/enums';
	import { collapseRangesForDisplay } from '$lib/utils/opticalRange';
	import { formatPrice } from '$lib/utils';
	import { AppBadge } from '$lib/components/ui';
	import {
		sourceMicroBadgeClass,
		sourceMicroBadgeLabel,
		statusLabel,
		statusVariant,
		supplierLabel,
		totalCost
	} from './lensCatalogDisplay';

	type LensViewHref = `/lenses/${string}`;
	type LensEditHref = `/lenses/${string}/edit`;

	interface Props {
		item: LensCatalogItemWithRelations;
		viewHref?: LensViewHref;
		editHref?: LensEditHref;
		canManage: boolean;
		onView?: (item: LensCatalogItemWithRelations) => void;
		onEdit?: (item: LensCatalogItemWithRelations) => void;
		onDelete: (item: LensCatalogItemWithRelations) => void;
	}

	let { item, viewHref, editHref, canManage, onView, onEdit, onDelete }: Props = $props();
	let displayRanges = $derived(collapseRangesForDisplay(item.ranges ?? []));
	let primaryRange = $derived(displayRanges[0]);
	let extraRanges = $derived(displayRanges.slice(1));
</script>

<tr
	class="bg-surface-container-lowest transition-colors {onView
		? 'cursor-pointer hover:bg-surface-container-low'
		: ''}"
	onclick={() => onView?.(item)}
>
	<td class="px-3 py-2 align-middle">
		<div class="max-w-[28rem] min-w-[18rem] xl:max-w-none">
			<p class="truncate text-sm font-semibold text-on-surface">{item.name}</p>
			<div class="flex items-center gap-2 text-[11px] text-on-surface-variant">
				<span class="truncate">{supplierLabel(item)}</span>
				<span
					class="inline-flex shrink-0 items-center rounded-sm px-1.5 py-0 text-[10px] leading-[1.1] font-semibold {sourceMicroBadgeClass(
						item
					)}"
				>
					{sourceMicroBadgeLabel(item)}
				</span>
			</div>
		</div>
	</td>
	<td class="px-3 py-2 align-middle">
		<div class="min-w-[15rem]">
			{#if primaryRange}
				<div class="flex flex-wrap items-center gap-2">
					<div class="inline-flex items-center gap-1">
						<p class="text-[10px] font-semibold tracking-[0.15em] text-outline uppercase">ESF</p>
						<span
							class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-xs font-bold text-brand-navy tabular-nums"
						>
							{primaryRange.sphereLabel}
						</span>
					</div>

					{#if primaryRange.cylinderLabel}
						<div class="inline-flex items-center gap-1">
							<p class="text-[10px] font-semibold tracking-[0.15em] text-outline uppercase">CIL</p>
							<span
								class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-xs font-bold text-brand-navy tabular-nums"
							>
								{primaryRange.cylinderLabel}
							</span>
						</div>
					{/if}

					{#if primaryRange.additionLabel}
						<div class="inline-flex items-center gap-1">
							<p class="text-[10px] font-semibold tracking-[0.15em] text-outline uppercase">ADD</p>
							<span
								class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-xs font-bold text-brand-navy tabular-nums"
							>
								{primaryRange.additionLabel}
							</span>
						</div>
					{/if}

					{#if extraRanges.length > 0}
						<div class="group relative z-10 focus-within:z-40 hover:z-40">
							<button
								type="button"
								aria-label={`Ver los ${displayRanges.length} rangos del lente`}
								onclick={(event) => event.stopPropagation()}
								class="inline-flex cursor-help rounded-md bg-brand-blue-light/30 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-brand-blue-dark uppercase transition-colors hover:bg-brand-blue-light/45 focus-visible:ring-2 focus-visible:ring-brand-blue/35 focus-visible:outline-none"
							>
								+{extraRanges.length} rango{extraRanges.length === 1 ? '' : 's'}
							</button>

							<div
								class="pointer-events-none invisible absolute right-0 bottom-full z-50 mb-2 w-72 translate-y-1 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3 opacity-0 shadow-lg transition-all duration-150 ease-out group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
							>
								<p class="text-[10px] font-semibold tracking-[0.18em] text-outline uppercase">
									Todos los rangos
								</p>
								<div class="mt-2 space-y-2">
									{#each displayRanges as range, rangeIndex (range.id)}
										<div class="rounded-xl bg-surface-container-low px-3 py-2">
											<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
												Rango {rangeIndex + 1}
											</p>
											<div class="mt-1.5 space-y-1 text-xs text-on-surface-variant">
												<p>
													<span class="font-semibold text-outline">Esfera:</span>
													<span class="ml-1 font-mono text-on-surface">{range.sphereLabel}</span>
												</p>
												{#if range.cylinderLabel}
													<p>
														<span class="font-semibold text-outline">Cilindro:</span>
														<span class="ml-1 font-mono text-on-surface">{range.cylinderLabel}</span
														>
													</p>
												{/if}
												{#if range.additionLabel}
													<p>
														<span class="font-semibold text-outline">Adición:</span>
														<span class="ml-1 font-mono text-on-surface">{range.additionLabel}</span
														>
													</p>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<span
					class="inline-flex rounded-md bg-surface-container-low px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.12em] text-outline uppercase"
				>
					{item.source === LensCatalogSource.LAB ? 'Consultar' : 'Sin rangos'}
				</span>
			{/if}
		</div>
	</td>
	<td class="px-3 py-2 align-middle">
		<div class="flex flex-col items-end justify-center">
			{#if item.salePrice != null}
				<span class="font-mono text-sm font-bold text-brand-navy tabular-nums">
					{formatPrice(item.salePrice)}
				</span>
				{#if item.pairPurchasePrice != null}
					<span class="text-xs text-slate-500">
						Costo: {formatPrice(totalCost(item))}
					</span>
				{/if}
			{:else}
				<span class="text-xs font-semibold text-outline">Por definir</span>
			{/if}
		</div>
	</td>
	<td class="px-3 py-2 text-right align-middle">
		<div class="flex flex-col items-end gap-1.5">
			<AppBadge variant={statusVariant(item)}>{statusLabel(item)}</AppBadge>
			{#if item.inventoryMode === LensInventoryMode.STOCK}
				<span class="font-mono text-[11px] font-semibold text-brand-navy tabular-nums">
					{item.stock ?? 0} unid.
				</span>
			{/if}
		</div>
	</td>
	<td class="px-3 py-2 text-right align-middle">
		<div class="flex items-center justify-end gap-1">
			{#if viewHref}
				<a
					href={resolve(viewHref)}
					onclick={(event) => event.stopPropagation()}
					class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-info-container text-on-info-container transition-colors hover:bg-brand-blue-light/40"
					title="Ver lente"
					aria-label="Ver lente"
				>
					<Eye class="h-3.5 w-3.5" />
				</a>
			{:else if onView}
				<button
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onView?.(item);
					}}
					class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-info-container text-on-info-container transition-colors hover:bg-brand-blue-light/40"
					title="Ver lente"
					aria-label="Ver lente"
				>
					<Eye class="h-3.5 w-3.5" />
				</button>
			{/if}

			{#if canManage}
				{#if editHref}
					<a
						href={resolve(editHref)}
						onclick={(event) => event.stopPropagation()}
						class="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
						title="Editar lente"
						aria-label="Editar lente"
					>
						<SquarePen class="h-3.5 w-3.5" />
					</a>
				{:else if onEdit}
					<button
						type="button"
						onclick={(event) => {
							event.stopPropagation();
							onEdit?.(item);
						}}
						class="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
						title="Editar lente"
						aria-label="Editar lente"
					>
						<SquarePen class="h-3.5 w-3.5" />
					</button>
				{/if}
			{/if}

			{#if canManage}
				<button
					type="button"
					onclick={(event) => {
						event.stopPropagation();
						onDelete(item);
					}}
					class="inline-flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
					title="Eliminar lente"
					aria-label="Eliminar lente"
				>
					<Trash2 class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>
	</td>
</tr>
