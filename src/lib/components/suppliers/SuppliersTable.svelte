<script lang="ts">
	import { TableHeadCell, TableBodyCell, Badge } from 'flowbite-svelte';
	import { SquarePen, Trash2, Truck, Eye } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteSupplierById } from '$lib/remote/suppliers.remote';
	import { getErrorMessage } from '$lib/utils';
	import { DataTable, ActionButton, ConfirmModal } from '$lib/components/ui';
	import { SupplierViewModal } from '$lib/components/suppliers';
	import { SupplierType, getSupplierBadgeColor, getSupplierTypeLabel } from '$lib/shared/enums';
	import type { Supplier } from '$lib/server/db/schema';

	interface Props {
		suppliers: Supplier[];
		loading?: boolean;
		onEdit: (supplier: Supplier) => void;
		onRefresh?: () => void;
	}

	let { suppliers, loading = false, onEdit, onRefresh }: Props = $props();

	// Modal state
	let showDeleteModal = $state(false);
	let showViewModal = $state(false);
	let selectedSupplier = $state<Supplier | null>(null);
	let deleteLoading = $state(false);

	function openView(supplier: Supplier) {
		selectedSupplier = supplier;
		showViewModal = true;
	}

	function openDelete(supplier: Supplier) {
		selectedSupplier = supplier;
		showDeleteModal = true;
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
		<TableHeadCell class="font-semibold">Nombre</TableHeadCell>
		<TableHeadCell class="font-semibold">Tipo</TableHeadCell>
		<TableHeadCell class="font-semibold">RIF</TableHeadCell>
		<TableHeadCell class="font-semibold">Teléfono</TableHeadCell>
		<TableHeadCell class="font-semibold">Contacto</TableHeadCell>
	{/snippet}

	{#snippet row(supplier)}
		<TableBodyCell class="font-medium">{supplier.name}</TableBodyCell>
		<TableBodyCell>
			<Badge color={getSupplierBadgeColor(supplier.type)}>
				{getSupplierTypeLabel(supplier.type)}
			</Badge>
		</TableBodyCell>
		<TableBodyCell>
			<span class="font-mono text-sm text-slate-600">{supplier.rif ?? '—'}</span>
		</TableBodyCell>
		<TableBodyCell>{supplier.primaryPhone}</TableBodyCell>
		<TableBodyCell>
			{#if supplier.contactName}
				<span>{supplier.contactName}</span>
				{#if supplier.contactRole}
					<span class="text-xs text-slate-500"> ({supplier.contactRole})</span>
				{/if}
			{:else}
				—
			{/if}
		</TableBodyCell>
	{/snippet}

	{#snippet actions(supplier)}
		<ActionButton icon={Eye} title="Ver detalles" onclick={() => openView(supplier)} />
		<ActionButton icon={SquarePen} title="Editar" color="blue" onclick={() => onEdit(supplier)} />
		<ActionButton icon={Trash2} title="Eliminar" color="red" onclick={() => openDelete(supplier)} />
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
	onClose={() => (selectedSupplier = null)}
	onEdit={() => {
		if (selectedSupplier) onEdit(selectedSupplier);
	}}
/>
