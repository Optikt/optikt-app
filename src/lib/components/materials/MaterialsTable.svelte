<script lang="ts">
	import {
		TableHeadCell,
		TableBodyCell,
		Modal,
		Button,
		Input,
		Label,
		Spinner,
		Badge
	} from 'flowbite-svelte';
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
			console.error(e);
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
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Nombre</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Código</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Tipo</th>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">Estado</th>
	{/snippet}

	{#snippet row(material)}
		<td class="font-medium px-4 py-3 text-sm">{material.name}</td>
		<td class="px-4 py-3 text-sm">
			<Badge color="gray" class="font-mono text-xs">{material.code}</Badge>
		</td>
		<TableBodyCell
			>{MATERIAL_CATEGORY_LABELS[material.productType as MaterialCategory] ??
				material.productType}</TableBodyCell
		>
		<td class="px-4 py-3 text-sm">
			<StatusBadge active={!material.deletedAt} />
		</td>
	{/snippet}
</DataTable>

<!-- Delete Confirm Modal -->
<Modal bind:open={showDeleteModal} title="Eliminar Material" size="sm">
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
			<Input
				id="confirmName"
				bind:value={confirmInput}
				placeholder="Escriba el nombre del material"
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
</Modal>

<!-- View Details Modal -->
<Modal bind:open={showViewModal} title="Detalles del Material" size="sm">
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

	<div class="mt-6 flex justify-end gap-2">
		<Button color="light" onclick={() => (selectedMaterial = null)}>Cerrar</Button>
		{#if canManage && onEdit}
			<Button
				color="blue"
				onclick={() => {
					if (selectedMaterial) onEdit(selectedMaterial);
				}}
			>
				<SquarePen class="mr-1.5 h-4 w-4" />
				Editar
			</Button>
		{/if}
	</div>
</Modal>

<!-- Reactivate Modal -->
<MaterialReactivateModal
	bind:open={showReactivateModal}
	candidate={selectedMaterial}
	onSuccess={() => {
		selectedMaterial = null;
		onRefresh?.();
	}}
/>
