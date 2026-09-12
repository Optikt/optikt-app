<script lang="ts">
	import { Layers } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteLensCatalogItemById } from '$lib/remote/lenses.remote';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { getErrorMessage } from '$lib/utils';
	import { ConfirmModal, DataGrid } from '$lib/components/ui';
	import LensCatalogMobileCard from './table/LensCatalogMobileCard.svelte';
	import LensCatalogRow from './table/LensCatalogRow.svelte';
	import { lensCatalogColumns } from './table/lensCatalogDisplay';

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

	function openDelete(item: LensCatalogItemWithRelations) {
		selectedItem = item;
		showDeleteModal = true;
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
			toast.error(getErrorMessage(error, 'Error eliminando lente'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

<DataGrid
	columns={lensCatalogColumns}
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
		<LensCatalogMobileCard
			{item}
			viewHref={getViewHref?.(item)}
			editHref={getEditHref?.(item)}
			{canManage}
			{onView}
			{onEdit}
			onDelete={openDelete}
		/>
	{/snippet}

	{#snippet row(item)}
		<LensCatalogRow
			{item}
			viewHref={getViewHref?.(item)}
			editHref={getEditHref?.(item)}
			{canManage}
			{onView}
			{onEdit}
			onDelete={openDelete}
		/>
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
