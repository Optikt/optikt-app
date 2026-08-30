<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { SquarePen, Trash2, Tag, TriangleAlert, Eye, RotateCcw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteBrandById, checkBrandCanDelete } from '$lib/remote/brands.remote';
	import { getErrorMessage } from '$lib/utils';
	import { DataGrid, StatusBadge } from '$lib/components/ui';
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

	const columns = [
		{ key: 'name', label: 'Nombre' },
		{ key: 'country', label: 'País' },
		{ key: 'website', label: 'Sitio Web' },
		{ key: 'status', label: 'Estado' },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];
</script>

<DataGrid
	{columns}
	items={brands}
	{loading}
	emptyTitle="No se encontraron marcas"
	emptySubtitle="Agrega una marca para comenzar"
>
	{#snippet emptyIcon()}
		<Tag class="mb-3 h-10 w-10 text-outline" />
	{/snippet}

	{#snippet row(brand)}
		<tr class="transition-colors hover:bg-surface-container-low">
			<td class="px-3 py-2.5 text-sm font-medium">{brand.name}</td>
			<td class="px-3 py-2.5 text-sm">{brand.country ?? '-'}</td>
			<td class="px-3 py-2.5 text-sm">
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
			<td class="px-3 py-2.5 text-sm">
				<StatusBadge active={!brand.deletedAt} />
			</td>
			<td class="px-3 py-2.5 text-sm">
				<div class="flex justify-end gap-1">
					<button
						onclick={() => openView(brand)}
						class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
						title="Ver detalles"
					>
						<Eye class="h-4 w-4" />
					</button>
					{#if canManage && onEdit}
						<button
							onclick={() => onEdit(brand)}
							class="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
							title="Editar"
						>
							<SquarePen class="h-4 w-4" />
						</button>
						{#if brand.deletedAt}
							<button
								onclick={() => openReactivate(brand)}
								class="rounded-lg p-1.5 text-green-600 hover:bg-green-50"
								title="Reactivar"
							>
								<RotateCcw class="h-4 w-4" />
							</button>
						{:else}
							<button
								onclick={() => openDelete(brand)}
								class="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
								title="Eliminar"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						{/if}
					{/if}
				</div>
			</td>
		</tr>
	{/snippet}
</DataGrid>

<!-- Enhanced Delete Confirm Modal -->
<Dialog.Root bind:open={showDeleteModal}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Eliminar Marca</Dialog.Title>
		</Dialog.Header>
		{#if checkingDelete}
			<div class="flex items-center justify-center py-8">
				<svg class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
					><circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					/><path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					/></svg
				>
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
								Esta marca tiene <strong
									>{productCount} producto{productCount > 1 ? 's' : ''}</strong
								>
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
					<input
						id="confirmName"
						bind:value={confirmInput}
						placeholder="Escriba el nombre de la marca"
						class="placeholder:text-slate-400"
					/>
				</div>
			</div>

			<Dialog.Footer class="flex justify-end gap-2">
				<Button variant="outline" onclick={closeModal}>Cancelar</Button>
				<Button
					variant="destructive"
					disabled={!canConfirm || deleteLoading}
					onclick={handleDelete}
				>
					{#if deleteLoading}<svg
							class="mx-auto h-5 w-5 animate-spin"
							viewBox="0 0 24 24"
							fill="none"
							><circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							/><path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/></svg
						>{/if}
					Eliminar
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

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
