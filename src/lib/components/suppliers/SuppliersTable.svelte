<script lang="ts">
	import { Truck, Eye, SquarePen, Trash2, RotateCcw, FlaskConical } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteSupplierById } from '$lib/remote/suppliers.remote';
	import { getErrorMessage } from '$lib/utils';
	import {
		DataTable,
		ConfirmModal,
		SupplierTypeBadge,
		StatusBadge,
		ActionButton
	} from '$lib/components/ui';
	import {
		SupplierViewModal,
		SupplierReactivateModal,
		SupplierTreatmentsModal
	} from '$lib/components/suppliers';
	import type { Supplier } from '$lib/server/db/schema';

	interface Props {
		suppliers: Supplier[];
		loading?: boolean;
		onEdit?: (supplier: Supplier) => void;
		canManage?: boolean;
		onRefresh?: () => void;
	}

	let { suppliers, loading = false, onEdit, canManage = true, onRefresh }: Props = $props();

	// Modal state
	let showDeleteModal = $state(false);
	let showViewModal = $state(false);
	let showReactivateModal = $state(false);
	let showTreatmentsModal = $state(false);
	let selectedSupplier = $state<Supplier | null>(null);
	let deleteLoading = $state(false);

	function openView(supplier: Supplier) {
		selectedSupplier = supplier;
		showViewModal = true;
	}

	function openDelete(supplier: Supplier) {
		if (!canManage) return;

		selectedSupplier = supplier;
		showDeleteModal = true;
	}

	function openReactivate(supplier: Supplier) {
		if (!canManage) return;

		selectedSupplier = supplier;
		showReactivateModal = true;
	}

	function openTreatments(supplier: Supplier) {
		selectedSupplier = supplier;
		showTreatmentsModal = true;
	}

	async function handleDelete() {
		if (!selectedSupplier) return;

		deleteLoading = true;
		try {
			await deleteSupplierById({ id: selectedSupplier.id });
			toast.success('Proveedor eliminado exitosamente');
			showDeleteModal = false;
			onRefresh?.();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error eliminando proveedor'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

<DataTable
	items={suppliers}
	{loading}
	emptyIcon={Truck}
	emptyTitle="No se encontraron proveedores"
	emptyDescription="Agrega un proveedor para comenzar"
>
	{#snippet header()}
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Nombre</th
		>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Tipo</th
		>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>RIF</th
		>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Teléfono</th
		>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Contacto</th
		>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Estado</th
		>
	{/snippet}

	{#snippet row(supplier)}
		<td class="font-medium px-4 py-3 text-sm">{supplier.name}</td>
		<td class="px-4 py-3 text-sm">
			<SupplierTypeBadge type={supplier.type} />
		</td>
		<td class="px-4 py-3 text-sm">
			<span class="font-mono text-sm text-slate-600">{supplier.rif ?? '-'}</span>
		</td>
		<td class="px-4 py-3 text-sm">{supplier.primaryPhone}</td>
		<td class="px-4 py-3 text-sm">
			{#if supplier.contactName}
				<span>{supplier.contactName}</span>
				{#if supplier.contactRole}
					<span class="text-xs text-slate-500"> ({supplier.contactRole})</span>
				{/if}
			{:else}
				-
			{/if}
		</td>
		<td class="px-4 py-3 text-sm">
			<StatusBadge active={!supplier.deletedAt} />
		</td>
	{/snippet}

	{#snippet actions(supplier)}
		<ActionButton icon={Eye} title="Ver detalles" onclick={() => openView(supplier)} />
		<ActionButton
			icon={FlaskConical}
			title="Tratamientos"
			color="blue"
			onclick={() => openTreatments(supplier)}
		/>
		{#if canManage && onEdit}
			<ActionButton icon={SquarePen} title="Editar" color="blue" onclick={() => onEdit(supplier)} />
			{#if supplier.deletedAt}
				<ActionButton
					icon={RotateCcw}
					title="Reactivar"
					color="green"
					onclick={() => openReactivate(supplier)}
				/>
			{:else}
				<ActionButton
					icon={Trash2}
					title="Eliminar"
					color="red"
					onclick={() => openDelete(supplier)}
				/>
			{/if}
		{/if}
	{/snippet}
</DataTable>

<!-- Delete Confirm Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Proveedor"
	message="¿Está seguro que desea eliminar el proveedor {selectedSupplier?.name}? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>

<!-- View Details Modal -->
<SupplierViewModal
	bind:open={showViewModal}
	supplier={selectedSupplier}
	canManageRelations={canManage}
	onClose={() => (selectedSupplier = null)}
	onEdit={canManage && onEdit
		? () => {
				if (selectedSupplier) onEdit(selectedSupplier);
			}
		: undefined}
/>

<!-- Reactivate Modal -->
<SupplierReactivateModal
	bind:open={showReactivateModal}
	candidate={selectedSupplier}
	onSuccess={() => {
		selectedSupplier = null;
		onRefresh?.();
	}}
/>

<!-- Treatments Modal -->
<SupplierTreatmentsModal
	bind:open={showTreatmentsModal}
	supplier={selectedSupplier}
	{canManage}
	onClose={() => (selectedSupplier = null)}
/>
