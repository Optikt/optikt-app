<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { User, Eye, SquarePen, Trash2, RotateCcw } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { deleteCustomerById } from '$lib/remote/customers.remote';
	import { getErrorMessage, getFullName } from '$lib/utils';
	import { DataTable, ConfirmModal, StatusBadge } from '$lib/components/ui';
	import CustomerReactivateModal from './CustomerReactivateModal.svelte';
	import type { Customer } from '$lib/server/db/schema';

	interface Props {
		customers: Customer[];
		loading?: boolean;
		onEdit: (customer: Customer) => void;
		onRefresh?: () => void;
	}

	let { customers, loading = false, onEdit, onRefresh }: Props = $props();

	// Modal state
	let showDeleteModal = $state(false);
	let showReactivateModal = $state(false);
	let selectedCustomer = $state<Customer | null>(null);
	let deleteLoading = $state(false);

	function openDelete(customer: Customer) {
		selectedCustomer = customer;
		showDeleteModal = true;
	}

	function openReactivate(customer: Customer) {
		selectedCustomer = customer;
		showReactivateModal = true;
	}

	async function handleDelete() {
		if (!selectedCustomer) return;

		deleteLoading = true;
		try {
			await deleteCustomerById({ id: selectedCustomer.id });
			toast.success('Cliente eliminado exitosamente');
			showDeleteModal = false;
			onRefresh?.();
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando cliente'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

<DataTable
	items={customers}
	{loading}
	emptyIcon={User}
	emptyTitle="No hay clientes"
	emptyDescription="Agrega tu primer cliente para comenzar"
	defaultActions="view,edit,delete,reactivate"
	onView={(c) => goto(resolve(`/customers/${c.id}`))}
	onEdit={(c) => onEdit(c)}
	onDelete={openDelete}
	onReactivate={openReactivate}
	viewIcon={Eye}
	editIcon={SquarePen}
	deleteIcon={Trash2}
	reactivateIcon={RotateCcw}
>
	{#snippet header()}
		<TableHeadCell class="font-semibold">Cliente</TableHeadCell>
		<TableHeadCell class="font-semibold">Cédula</TableHeadCell>
		<TableHeadCell class="font-semibold">Teléfono</TableHeadCell>
		<TableHeadCell class="font-semibold">Email</TableHeadCell>
		<TableHeadCell class="font-semibold">Estado</TableHeadCell>
	{/snippet}

	{#snippet row(customer)}
		<TableBodyCell>
			<div class="flex items-center gap-3">
				<div>
					<div class="font-medium text-slate-900">{getFullName(customer)}</div>
				</div>
			</div>
		</TableBodyCell>
		<TableBodyCell>
			<span class="font-mono text-sm text-slate-600">{customer.idNumber ?? '—'}</span>
		</TableBodyCell>
		<TableBodyCell>
			<span class="text-slate-600">{customer.primaryPhone}</span>
		</TableBodyCell>
		<TableBodyCell>
			<span class="text-slate-600">{customer.email ?? '—'}</span>
		</TableBodyCell>
		<TableBodyCell>
			<StatusBadge active={!customer.deletedAt} />
		</TableBodyCell>
	{/snippet}
</DataTable>

<!-- Delete Confirmation -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Cliente"
	message="¿Estás seguro de que deseas eliminar a {selectedCustomer
		? getFullName(selectedCustomer)
		: ''}? Esta acción se puede deshacer reactivando el cliente."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>

<!-- Reactivate Modal -->
<CustomerReactivateModal
	bind:open={showReactivateModal}
	candidate={selectedCustomer}
	onSuccess={() => {
		selectedCustomer = null;
		onRefresh?.();
	}}
/>
