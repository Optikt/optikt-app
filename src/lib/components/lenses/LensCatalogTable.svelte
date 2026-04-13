<script lang="ts">
	import { TableHeadCell, TableBodyCell, Badge, Popover } from 'flowbite-svelte';
	import { Trash2, Eye, Layers, SquarePen } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage, formatPrice } from '$lib/utils';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import { LensCatalogSource, getLensSourceLabel } from '$lib/shared/enums';
	import { collapseRangesForDisplay } from '$lib/utils/opticalRange';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		DataTable,
		ActionButton,
		ConfirmModal,
		LensTypeBadge,
		TreatmentBadge
	} from '$lib/components/ui';

	type Props = {
		items: LensCatalogItemWithRelations[];
		loading: boolean;
		onRefresh: () => void;
	};

	let { items, loading, onRefresh }: Props = $props();

	let showDeleteModal = $state(false);
	let selectedItem = $state<LensCatalogItemWithRelations | null>(null);
	let deleteLoading = $state(false);

	function openDelete(item: LensCatalogItemWithRelations) {
		selectedItem = item;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!selectedItem) return;
		deleteLoading = true;
		try {
			await deleteLensCatalogItemById({ id: selectedItem.id });
			toast.success('Item eliminado del catálogo');
			showDeleteModal = false;
			onRefresh();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando item'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

<DataTable
	{items}
	{loading}
	emptyIcon={Layers}
	emptyTitle="No hay lentes en el catálogo"
	emptyDescription="Agrega un cristal para comenzar"
>
	{#snippet header()}
		<TableHeadCell class="font-semibold">Nombre</TableHeadCell>
		<TableHeadCell class="font-semibold">Origen</TableHeadCell>
		<TableHeadCell class="font-semibold">Proveedor</TableHeadCell>
		<TableHeadCell class="font-semibold">Tipo</TableHeadCell>
		<TableHeadCell class="font-semibold">Material</TableHeadCell>
		<TableHeadCell class="font-semibold">Rangos</TableHeadCell>
		<TableHeadCell class="text-right font-semibold">Costo por Par</TableHeadCell>
		<TableHeadCell class="text-right font-semibold">Precio Venta</TableHeadCell>
		<TableHeadCell class="text-right font-semibold">Margen</TableHeadCell>
	{/snippet}

	{#snippet row(item)}
		{@const displayRanges = collapseRangesForDisplay(item.ranges ?? [])}
		<TableBodyCell>
			<div>
				<p class="font-medium text-slate-800">{item.name}</p>
			</div>
		</TableBodyCell>
		<TableBodyCell>
			<Badge color={item.source === LensCatalogSource.FINISHED ? 'indigo' : 'gray'} class="text-xs">
				{getLensSourceLabel(item.source)}
			</Badge>
		</TableBodyCell>
		<TableBodyCell class="text-slate-600">
			{item.supplier?.name ?? '—'}
		</TableBodyCell>
		<TableBodyCell>
			<LensTypeBadge type={item.type} />
			{#if item.isPhotochromic}
				<TreatmentBadge type="photochromic" class="ml-1" />
			{/if}
			{#if item.hasBluecut}
				<TreatmentBadge type="blueBlock" class="ml-1" />
			{/if}
			{#if item.hasAr}
				<TreatmentBadge type="antiReflective" class="ml-1" />
			{/if}
		</TableBodyCell>
		<TableBodyCell>
			{#if item.material}
				<span class="text-slate-700">{item.material.name}</span>
			{:else}
				<span class="text-slate-400">—</span>
			{/if}
		</TableBodyCell>
		<TableBodyCell>
			{#if displayRanges.length > 0}
				<button
					id="ranges-{item.id}"
					class="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
				>
					<Layers class="h-3 w-3" />
					{displayRanges.length}
					{displayRanges.length === 1 ? 'rango' : 'rangos'}
				</button>
				<Popover triggeredBy="#ranges-{item.id}" class="w-72 text-sm" trigger="hover">
					<div class="space-y-2">
						{#each displayRanges as dr, i (dr.id)}
							<div class="rounded-md bg-slate-50 p-2">
								{#if displayRanges.length > 1}
									<p class="mb-1 text-xs font-semibold text-slate-500">
										Rango {i + 1}
										{#if dr.symmetric}
											<span class="ml-1 text-indigo-500">(±)</span>
										{/if}
									</p>
								{/if}
								<div class="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
									<span class="text-slate-500">Esfera:</span>
									<span class="text-slate-800">{dr.sphereLabel}</span>
									{#if dr.cylinderLabel}
										<span class="text-slate-500">Cilindro:</span>
										<span class="text-slate-800">{dr.cylinderLabel}</span>
									{/if}
									{#if dr.additionLabel}
										<span class="text-slate-500">Adición:</span>
										<span class="text-slate-800">{dr.additionLabel}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</Popover>
			{:else}
				<span class="text-slate-400">—</span>
			{/if}
		</TableBodyCell>
		<TableBodyCell class="text-right font-mono font-medium text-slate-800">
			{formatPrice(item.pairPurchasePrice)}
			{#if item.priceType === 'UNIT'}
				<span class="font-normal text-slate-400">(×2 unid.)</span>
			{/if}
		</TableBodyCell>
		<TableBodyCell class="text-right font-mono font-medium">
			{#if item.salePrice}
				<span class="text-emerald-700">{formatPrice(item.salePrice)}</span>
			{:else}
				<span class="text-slate-400">—</span>
			{/if}
		</TableBodyCell>
		<TableBodyCell class="text-right font-mono font-medium">
			{@const margin =
				item.salePrice && item.pairPurchasePrice > 0
					? ((item.salePrice - item.pairPurchasePrice) / item.pairPurchasePrice) * 100
					: null}
			{#if margin != null}
				<span class={margin >= 0 ? 'text-emerald-600' : 'text-red-600'}>
					{margin >= 0 ? '+' : ''}{margin.toFixed(0)}%
				</span>
			{:else}
				<span class="text-slate-400">—</span>
			{/if}
		</TableBodyCell>
	{/snippet}

	{#snippet actions(item)}
		<ActionButton
			icon={Eye}
			title="Ver detalles"
			onclick={() => goto(resolve(`/lenses/${item.id}`))}
		/>
		<ActionButton
			icon={SquarePen}
			title="Editar"
			color="blue"
			onclick={() => goto(resolve(`/lenses/${item.id}/edit`))}
		/>
		<ActionButton icon={Trash2} title="Eliminar" color="red" onclick={() => openDelete(item)} />
	{/snippet}
</DataTable>

<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar del Catálogo"
	message="¿Eliminar &quot;{selectedItem?.name}&quot; del catálogo?"
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>
