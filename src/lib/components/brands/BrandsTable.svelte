<script lang="ts">
	import { Modal, Button, Input, Label, Spinner } from 'flowbite-svelte';
	import { SquarePen, Trash2, Tag, TriangleAlert, Eye, RotateCcw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteBrandById, checkBrandCanDelete } from '$lib/remote/brands.remote';
	import { getErrorMessage } from '$lib/utils';
	import { DataTable, StatusBadge } from '$lib/components/ui';
	import { BrandViewModal, BrandReactivateModal } from '$lib/components/brands';
	import type { Brand } from '$lib/server/db/schema';

	interface Props {
		brands: Brand[];
		loading?: boolean;
		onEdit?: (brand: Brand) => void;
		canManage?: boolean;
		onRefresh?: () => void;
	}

	let { brands, loading = false, onEdit, canManage = true, onRefresh }: Props = $props();

	// Modal state
	let showDeleteModal = $state(false);
	let showViewModal = $state(false);
	let showReactivateModal = $state(false);
	let selectedBrand = $state<Brand | null>(null);
	let deleteLoading = $state(false);
	let checkingDelete = $state(false);
	let productCount = $state(0);
	let confirmInput = $state('');

	// For safety, user must type brand name to confirm
	const canConfirm = $derived(confirmInput === selectedBrand?.name);
	const hasProducts = $derived(productCount > 0);

	function openView(brand: Brand) {
		selectedBrand = brand;
		showViewModal = true;
	}

	async function openDelete(brand: Brand) {
		if (!canManage) return;

		selectedBrand = brand;
		confirmInput = '';
		checkingDelete = true;
		showDeleteModal = true;

		try {
			const result = await checkBrandCanDelete({ id: brand.id });
			productCount = result.productCount;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error verificando marca'));
			showDeleteModal = false;
		} finally {
			checkingDelete = false;
		}
	}

	function openReactivate(brand: Brand) {
		if (!canManage) return;

		selectedBrand = brand;
		showReactivateModal = true;
	}

	async function handleDelete() {
		if (!selectedBrand || !canConfirm) return;

		deleteLoading = true;
		try {
			await deleteBrandById({ id: selectedBrand.id });
			toast.success('Marca eliminada exitosamente');
			showDeleteModal = false;
			onRefresh?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando marca'));
		} finally {
			deleteLoading = false;
		}
	}

	function closeModal() {
		showDeleteModal = false;
		selectedBrand = null;
		confirmInput = '';
		productCount = 0;
	}
</script>

<DataTable
	items={brands}
	{loading}
	emptyIcon={Tag}
	emptyTitle="No se encontraron marcas"
	emptyDescription="Agrega una marca para comenzar"
	defaultActions={canManage ? 'view,edit,delete,reactivate' : 'view'}
	onView={openView}
	viewIcon={Eye}
	onEdit={canManage && onEdit ? (b) => onEdit(b) : undefined}
	editIcon={SquarePen}
	onDelete={canManage ? openDelete : undefined}
	deleteIcon={Trash2}
	onReactivate={canManage ? openReactivate : undefined}
	reactivateIcon={RotateCcw}
>
	{#snippet header()}
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Nombre</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">País</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Sitio Web</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Estado</th>
	{/snippet}

	{#snippet row(brand)}
		<td class="font-medium px-4 py-3 text-sm">{brand.name}</td>
		<td class="px-4 py-3 text-sm">{brand.country ?? '-'}</td>
		<td class="px-4 py-3 text-sm">
			{#if brand.website}
				<a
					href={brand.website}
					target="_blank"
					rel="noopener noreferrer external"
					class="text-primary-600 hover:underline"
				>
					{brand.website}
				</a>
			{:else}
				-
			{/if}
		</td>
		<td class="px-4 py-3 text-sm">
			<StatusBadge active={!brand.deletedAt} />
		</td>
	{/snippet}
</DataTable>

<!-- Enhanced Delete Confirm Modal -->
<Modal bind:open={showDeleteModal} title="Eliminar Marca" size="sm">
	{#if checkingDelete}
		<div class="flex items-center justify-center py-8">
			<Spinner size="8" />
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			{#if hasProducts}
				<!-- Warning for brands with products -->
				<div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
					<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
					<div>
						<p class="font-medium text-amber-800">¡Atención!</p>
						<p class="mt-1 text-sm text-amber-700">
							Esta marca tiene <strong>{productCount} producto{productCount > 1 ? 's' : ''}</strong>
							asociado{productCount > 1 ? 's' : ''}. Los productos quedarán sin marca asignada.
						</p>
					</div>
				</div>
			{/if}

			<p class="text-slate-600">
				¿Está seguro que desea eliminar la marca <strong>{selectedBrand?.name}</strong>?
			</p>

			<!-- Confirmation input -->
			<div>
				<Label for="confirmName" class="mb-2">
					Escriba <strong class="text-red-600">{selectedBrand?.name}</strong> para confirmar:
				</Label>
				<Input
					id="confirmName"
					bind:value={confirmInput}
					placeholder="Escriba el nombre de la marca"
					class="placeholder:text-slate-400"
				/>
			</div>
		</div>

		<div class="mt-6 flex justify-end gap-2">
			<Button color="light" onclick={closeModal}>Cancelar</Button>
			<Button color="red" disabled={!canConfirm || deleteLoading} onclick={handleDelete}>
				{#if deleteLoading}<Spinner size="4" class="mr-2" />{/if}
				Eliminar
			</Button>
		</div>
	{/if}
</Modal>

<!-- View Details Modal -->
<BrandViewModal
	bind:open={showViewModal}
	brand={selectedBrand}
	canManageRelations={canManage}
	onClose={() => (selectedBrand = null)}
	onEdit={canManage && onEdit
		? () => {
				if (selectedBrand) onEdit(selectedBrand);
			}
		: undefined}
/>

<!-- Reactivate Modal -->
<BrandReactivateModal
	bind:open={showReactivateModal}
	candidate={selectedBrand}
	onSuccess={() => {
		selectedBrand = null;
		onRefresh?.();
	}}
/>
