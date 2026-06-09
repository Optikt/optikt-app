<script lang="ts">
	import { Eye, SquarePen, Trash2, Layers } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { resolve } from '$app/paths';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { LensCatalogSource, LensInventoryMode } from '$lib/shared/enums';
	import { collapseRangesForDisplay } from '$lib/utils/opticalRange';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { AppBadge, ConfirmModal, DataGrid } from '$lib/components/ui';

	type LensViewHref = `/lenses/${string}`;
	type LensEditHref = `/lenses/${string}/edit`;

	interface Props {
		items: LensCatalogItemWithRelations[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		onView?: (item: LensCatalogItemWithRelations) => void;
		onEdit?: (item: LensCatalogItemWithRelations) => void;
		getViewHref?: (item: LensCatalogItemWithRelations) => LensViewHref;
		getEditHref?: (item: LensCatalogItemWithRelations) => LensEditHref;
		canManage?: boolean;
		onRefresh?: () => void | Promise<void>;
		onPageChange: (page: number) => void;
	}

	let {
		items,
		page,
		perPage,
		total,
		totalPages,
		loading = false,
		onView,
		onEdit,
		getViewHref,
		getEditHref,
		canManage = true,
		onRefresh,
		onPageChange
	}: Props = $props();

	let showDeleteModal = $state(false);
	let deleteLoading = $state(false);
	let selectedItem = $state<LensCatalogItemWithRelations | null>(null);

	const columns = [
		{ key: 'lens', label: 'Lente' },
		{ key: 'ranges', label: 'Rangos ópticos' },
		{ key: 'price', label: 'Precio venta', align: 'right' as const },
		{ key: 'status', label: 'Estado', align: 'right' as const },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];

	function openDelete(item: LensCatalogItemWithRelations) {
		selectedItem = item;
		showDeleteModal = true;
	}

	function statusVariant(
		item: LensCatalogItemWithRelations
	): 'success' | 'warning' | 'error' | 'neutral' {
		if (item.inventoryMode === LensInventoryMode.ON_DEMAND) return 'warning';
		if (item.stock == null) return 'neutral';
		if (item.stock <= 0) return 'error';
		return 'success';
	}

	function statusLabel(item: LensCatalogItemWithRelations): string {
		if (item.inventoryMode === LensInventoryMode.ON_DEMAND) return 'Por pedido';
		if (item.stock == null) return 'Sin dato';
		if (item.stock <= 0) return 'Agotado';
		return 'En stock';
	}

	function supplierLabel(item: LensCatalogItemWithRelations): string {
		return item.supplier?.name?.trim() || 'Sin proveedor';
	}

	async function handleDelete() {
		if (!selectedItem) return;

		deleteLoading = true;
		try {
			await deleteLensCatalogItemById({ id: selectedItem.id });
			toast.success('Lente eliminado del catálogo');
			showDeleteModal = false;
			await onRefresh?.();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error eliminando lente'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

<DataGrid
	{columns}
	{items}
	{page}
	{perPage}
	{total}
	{totalPages}
	{loading}
	itemLabel="lentes"
	emptyTitle="No hay lentes cargados"
	emptySubtitle="Agrega un lente para comenzar a construir el catálogo"
	{onPageChange}
>
	{#snippet emptyIcon()}
		<Layers class="mb-3 h-10 w-10 text-outline" />
	{/snippet}

	{#snippet mobileCard(item)}
		{@const displayRanges = collapseRangesForDisplay(item.ranges ?? [])}
		{@const primaryRange = displayRanges[0]}
		{@const viewHref = getViewHref?.(item)}
		{@const editHref = getEditHref?.(item)}
		<div class="space-y-2.5">
			<div class="flex items-start justify-between gap-2">
				<div class="min-w-0 flex-1">
					<h3 class="truncate text-sm leading-5 font-semibold text-on-surface">{item.name}</h3>
					<p class="truncate text-[11px] text-on-surface-variant">{supplierLabel(item)}</p>
				</div>

				<div class="shrink-0 text-right">
					{#if item.salePrice != null}
						<p
							class="font-mono text-sm font-bold text-brand-navy"
							title={`Costo par: ${formatPrice(item.pairPurchasePrice)}`}
						>
							{formatPrice(item.salePrice)}
						</p>
					{:else}
						<p class="text-xs font-semibold text-outline">Por definir</p>
					{/if}
				</div>
			</div>

			<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
				{#if primaryRange}
					<div class="flex flex-wrap gap-1.5">
						<span
							class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-navy"
						>
							ESF {primaryRange.sphereLabel}
						</span>
						{#if primaryRange.cylinderLabel}
							<span
								class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-navy"
							>
								CIL {primaryRange.cylinderLabel}
							</span>
						{/if}
					</div>
				{:else}
					<p class="text-xs font-semibold text-outline">
						{item.source === LensCatalogSource.LAB ? 'Consultar laboratorio' : 'Sin rangos'}
					</p>
				{/if}
			</div>

			<div
				class="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-2.5 py-2"
			>
				<AppBadge variant={statusVariant(item)}>{statusLabel(item)}</AppBadge>
				<div class="flex items-center gap-1">
					{#if viewHref}
						<a
							href={resolve(viewHref)}
							class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-info-container text-on-info-container transition-colors hover:bg-brand-blue-light/40"
							title="Ver lente"
							aria-label="Ver lente"
						>
							<Eye class="h-3.5 w-3.5" />
						</a>
					{:else if onView}
						<button
							type="button"
							onclick={() => onView?.(item)}
							class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-info-container text-on-info-container transition-colors hover:bg-brand-blue-light/40"
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
								class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
								title="Editar lente"
								aria-label="Editar lente"
							>
								<SquarePen class="h-3.5 w-3.5" />
							</a>
						{:else if onEdit}
							<button
								type="button"
								onclick={() => onEdit?.(item)}
								class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
								title="Editar lente"
							>
								<SquarePen class="h-3.5 w-3.5" />
							</button>
						{/if}
					{/if}

					{#if canManage}
						<button
							type="button"
							onclick={() => openDelete(item)}
							class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
							title="Eliminar lente"
							aria-label="Eliminar lente"
						>
							<Trash2 class="h-3.5 w-3.5" />
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet row(item)}
		{@const displayRanges = collapseRangesForDisplay(item.ranges ?? [])}
		{@const primaryRange = displayRanges[0]}
		{@const extraRanges = displayRanges.slice(1)}
		{@const viewHref = getViewHref?.(item)}
		{@const editHref = getEditHref?.(item)}
		<tr
			class="bg-surface-container-lowest transition-colors {onView
				? 'cursor-pointer hover:bg-surface-container-low'
				: ''}"
			onclick={() => onView?.(item)}
		>
			<td class="px-3 py-2 align-middle">
				<div class="max-w-[28rem] min-w-[18rem]">
					<p class="truncate text-sm font-semibold text-on-surface">{item.name}</p>
					<p class="truncate text-[11px] text-on-surface-variant">{supplierLabel(item)}</p>
				</div>
			</td>
			<td class="px-3 py-2 align-middle">
				<div class="min-w-[15rem]">
					{#if primaryRange}
						<div class="flex flex-wrap items-center gap-2">
							<div class="inline-flex items-center gap-1">
								<p class="text-[10px] font-semibold tracking-[0.15em] text-outline uppercase">
									ESF
								</p>
								<span
									class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-xs font-bold text-brand-navy tabular-nums"
								>
									{primaryRange.sphereLabel}
								</span>
							</div>

							{#if primaryRange.cylinderLabel}
								<div class="inline-flex items-center gap-1">
									<p class="text-[10px] font-semibold tracking-[0.15em] text-outline uppercase">
										CIL
									</p>
									<span
										class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-xs font-bold text-brand-navy tabular-nums"
									>
										{primaryRange.cylinderLabel}
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
													<p
														class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase"
													>
														Rango {rangeIndex + 1}
													</p>
													<div class="mt-1.5 space-y-1 text-xs text-on-surface-variant">
														<p>
															<span class="font-semibold text-outline">Esfera:</span>
															<span class="ml-1 font-mono text-on-surface">{range.sphereLabel}</span
															>
														</p>
														{#if range.cylinderLabel}
															<p>
																<span class="font-semibold text-outline">Cilindro:</span>
																<span class="ml-1 font-mono text-on-surface"
																	>{range.cylinderLabel}</span
																>
															</p>
														{/if}
														{#if range.additionLabel}
															<p>
																<span class="font-semibold text-outline">Adición:</span>
																<span class="ml-1 font-mono text-on-surface"
																	>{range.additionLabel}</span
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
			<td class="px-3 py-2 text-right align-middle">
				<div>
					{#if item.salePrice != null}
						<p
							class="font-mono text-sm font-bold text-brand-navy tabular-nums"
							title={`Costo par: ${formatPrice(item.pairPurchasePrice)}`}
						>
							{formatPrice(item.salePrice)}
						</p>
					{:else}
						<p class="text-xs font-semibold text-outline">Por definir</p>
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
								openDelete(item);
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
	{/snippet}
</DataGrid>

<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar lente"
	message={selectedItem ? `¿Eliminar "${selectedItem.name}" del catálogo?` : undefined}
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>
