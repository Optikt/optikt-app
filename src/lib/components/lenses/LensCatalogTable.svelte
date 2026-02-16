<script lang="ts">
	import { TableHeadCell, TableBodyCell, Badge, Popover } from 'flowbite-svelte';
	import { Pencil, Trash2, Eye, Layers } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage, formatPrice } from '$lib/utils';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import {
		LensType,
		LensCatalogSource,
		LENS_TYPE_LABELS,
		LENS_SOURCE_LABELS
	} from '$lib/shared/enums';
	import { collapseRangesForDisplay } from '$lib/utils/opticalRange';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { resolve } from '$app/paths';
	import { DataTable, ActionButton, ConfirmModal } from '$lib/components/ui';

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

	function getLensTypeBadgeColor(type: string): 'blue' | 'green' | 'purple' | 'yellow' {
		switch (type) {
			case LensType.MONOFOCAL:
				return 'blue';
			case LensType.BIFOCAL:
				return 'green';
			case LensType.PROGRESSIVE:
				return 'purple';
			case LensType.OCCUPATIONAL:
				return 'yellow';
			default:
				return 'blue';
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
		<TableHeadCell class="font-semibold">Tecnología</TableHeadCell>
		<TableHeadCell class="font-semibold">Rangos</TableHeadCell>
		<TableHeadCell class="text-right font-semibold">Precio Compra</TableHeadCell>
	{/snippet}

	{#snippet row(item)}
		{@const displayRanges = collapseRangesForDisplay(item.ranges ?? [])}
		<TableBodyCell>
			<div>
				<p class="font-medium text-slate-800">{item.name}</p>
				{#if item.brand}
					<p class="text-xs text-slate-500">{item.brand}</p>
				{/if}
			</div>
		</TableBodyCell>
		<TableBodyCell>
			<Badge color={item.source === LensCatalogSource.FINISHED ? 'indigo' : 'gray'} class="text-xs">
				{LENS_SOURCE_LABELS[item.source] ?? item.source}
			</Badge>
		</TableBodyCell>
		<TableBodyCell class="text-slate-600">
			{item.supplier?.name ?? '—'}
		</TableBodyCell>
		<TableBodyCell>
			<Badge color={getLensTypeBadgeColor(item.type)} class="text-xs">
				{LENS_TYPE_LABELS[item.type as LensType] ?? item.type}
			</Badge>
			{#if item.isPhotochromic}
				<Badge color="yellow" title="Fotocromático" class="ml-1 text-xs">Foto</Badge>
			{/if}
			{#if item.isBlueCut}
				<Badge color="indigo" title="Blue Cut (Blue Block)" class="ml-1 text-xs">Blue</Badge>
			{/if}
			{#if item.isAR}
				<Badge color="green" title="Antirreflejo (AR)" class="ml-1 text-xs">AR</Badge>
			{/if}
		</TableBodyCell>
		<TableBodyCell>
			{#if item.material}
				<span class="text-slate-700">{item.material.name}</span>
			{:else}
				<span class="text-slate-400">—</span>
			{/if}
		</TableBodyCell>
		<TableBodyCell class="text-slate-600">
			{item.technology ?? '—'}
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
			{formatPrice(item.basePrice)}
			<span class="font-normal text-slate-400">
				({item.pricingUnit === 'PAIR' ? 'par' : 'und'})
			</span>
		</TableBodyCell>
	{/snippet}

	{#snippet actions(item)}
		<ActionButton icon={Eye} title="Ver detalles" href={resolve(`/lenses/${item.id}`)} />
		<ActionButton
			icon={Pencil}
			title="Editar"
			color="blue"
			href={resolve(`/lenses/${item.id}/edit`)}
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
