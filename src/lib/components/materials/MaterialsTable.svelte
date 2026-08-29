<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Tag, TriangleAlert, Eye, SquarePen, Trash2, RotateCcw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteMaterialById } from '$lib/remote/materials.remote';
	import { getErrorMessage } from '$lib/utils';
	import { DataTable, StatusBadge } from '$lib/components/ui';
	import MaterialReactivateModal from '$lib/components/materials/MaterialReactivateModal.svelte';
	import type { Material } from '$lib/server/db/schema';
	import { MATERIAL_CATEGORY_LABELS } from '$lib/shared/enums/productTypes';
	import type { MaterialCategory } from '$lib/shared/enums/productTypes';

	interface Props {
		materials: Material[];
		loading?: boolean;
		onEdit?: (material: Material) => void;
		canManage?: boolean;
		onRefresh?: () => void;
	}

	let { materials, loading = false, onEdit, canManage = true, onRefresh }: Props = $props();

	// Modal state
	let showDeleteModal = $state(false);
	let showViewModal = $state(false);
	let showReactivateModal = $state(false);
	let selectedMaterial = $state<Material | null>(null);
	let deleteLoading = $state(false);
	let confirmInput = $state('');

	// For safety, user must type material name to confirm
	const canConfirm = $derived(confirmInput === selectedMaterial?.name);

	function openView(material: Material) {
		selectedMaterial = material;
		showViewModal = true;
	}

	function openDelete(material: Material) {
		if (!canManage) return;

		selectedMaterial = material;
		confirmInput = '';
		showDeleteModal = true;
	}

	function openReactivate(material: Material) {
		if (!canManage) return;

		selectedMaterial = material;
		showReactivateModal = true;
	}

	async function handleDelete() {
		if (!selectedMaterial || !canConfirm) return;

		deleteLoading = true;
		try {
			await deleteMaterialById({ id: selectedMaterial.id });
			toast.success('Material eliminado exitosamente');
			showDeleteModal = false;
			onRefresh?.();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error eliminando material'));
		} finally {
			deleteLoading = false;
		}
	}

	function closeModal() {
		showDeleteModal = false;
		selectedMaterial = null;
		confirmInput = '';
	}
</script>

<DataTable
	items={materials}
	{loading}
	emptyIcon={Tag}
	emptyTitle="No se encontraron materiales"
	emptyDescription="Agrega un material para comenzar"
	defaultActions={canManage ? 'view,edit,delete,reactivate' : 'view'}
	onView={openView}
	onEdit={canManage && onEdit ? (m) => onEdit(m) : undefined}
	onDelete={canManage ? openDelete : undefined}
	onReactivate={canManage ? openReactivate : undefined}
	viewIcon={Eye}
	editIcon={SquarePen}
	deleteIcon={Trash2}
	reactivateIcon={RotateCcw}
>
	{#snippet header()}
		<th class="px-4 py-3 text-xs font-medium font-semibold tracking-wider text-slate-500 uppercase"
			>Nombre</th
		>
		<th class="px-4 py-3 text-xs font-medium font-semibold tracking-wider text-slate-500 uppercase"
			>Código</th
		>
		<th class="px-4 py-3 text-xs font-medium font-semibold tracking-wider text-slate-500 uppercase"
			>Tipo</th
		>
		<th class="px-4 py-3 text-xs font-medium font-semibold tracking-wider text-slate-500 uppercase"
			>Estado</th
		>
	{/snippet}

	{#snippet row(material)}
		<td class="px-4 py-3 text-sm font-medium">{material.name}</td>
		<td class="px-4 py-3 text-sm">
			<span
				class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600"
				>{material.code}</span
			>
		</td>
		<td
			>{MATERIAL_CATEGORY_LABELS[material.productType as MaterialCategory] ??
				material.productType}</td
		>
		<td class="px-4 py-3 text-sm">
			<StatusBadge active={!material.deletedAt} />
		</td>
	{/snippet}
</DataTable>

<!-- Delete Confirm Modal -->
<Dialog.Root bind:open={showDeleteModal}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Eliminar Material</Dialog.Title>
		</Dialog.Header>
		<div class="flex flex-col gap-4">
			<div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
				<TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
				<div>
					<p class="font-medium text-red-800">¿Está seguro?</p>
					<p class="mt-1 text-sm text-red-700">
						Esta acción eliminará el material <strong>{selectedMaterial?.name}</strong>.
					</p>
				</div>
			</div>

			<p class="text-slate-600">
				Escriba <strong>{selectedMaterial?.name}</strong> para confirmar:
			</p>

			<!-- Confirmation input -->
			<div>
				<Label for="confirmName" class="mb-2">Escriba el nombre del material:</Label>
				<input
					id="confirmName"
					bind:value={confirmInput}
					placeholder="Escriba el nombre del material"
					class="placeholder:text-slate-400"
				/>
			</div>
		</div>

		<Dialog.Footer class="flex justify-end gap-2">
			<Button variant="outline" onclick={closeModal}>Cancelar</Button>
			<Button variant="destructive" disabled={!canConfirm || deleteLoading} onclick={handleDelete}>
				{#if deleteLoading}<svg class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
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
	</Dialog.Content>
</Dialog.Root>

<!-- View Details Modal -->
<Dialog.Root bind:open={showViewModal}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Detalles del Material</Dialog.Title>
		</Dialog.Header>
		{#if selectedMaterial}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<p class="text-sm text-gray-500">Nombre</p>
						<p class="font-medium">{selectedMaterial.name}</p>
					</div>
					<div>
						<p class="text-sm text-gray-500">Código</p>
						<p class="font-mono">{selectedMaterial.code}</p>
					</div>
					<div>
						<p class="text-sm text-gray-500">Tipo</p>
						<p>
							{MATERIAL_CATEGORY_LABELS[selectedMaterial.productType as MaterialCategory] ??
								selectedMaterial.productType}
						</p>
					</div>
				</div>
				{#if selectedMaterial.description}
					<div>
						<p class="text-sm text-gray-500">Descripción</p>
						<p>{selectedMaterial.description}</p>
					</div>
				{/if}
			</div>
		{/if}

		<Dialog.Footer class="flex justify-end gap-2">
			<Button variant="outline" onclick={() => (selectedMaterial = null)}>Cerrar</Button>
			{#if canManage && onEdit}
				<Button
					onclick={() => {
						if (selectedMaterial) onEdit(selectedMaterial);
					}}
				>
					<SquarePen class="mr-1.5 h-4 w-4" />
					Editar
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Reactivate Modal -->
<MaterialReactivateModal
	bind:open={showReactivateModal}
	candidate={selectedMaterial}
	onSuccess={() => {
		selectedMaterial = null;
		onRefresh?.();
	}}
/>
