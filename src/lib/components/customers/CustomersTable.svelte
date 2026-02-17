<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { SquarePen, Trash2, User, Eye } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { resolve } from '$app/paths';
	import { deleteCustomerById } from '$lib/remote/customers.remote';
	import { getErrorMessage, getFullName } from '$lib/utils';
	import { DataTable, ActionButton, ConfirmModal } from '$lib/components/ui';
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
	let selectedCustomer = $state<Customer | null>(null);
	let deleteLoading = $state(false);

	function openDelete(customer: Customer) {
		selectedCustomer = customer;
		showDeleteModal = true;
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
>
	{#snippet header()}
		<TableHeadCell class="font-semibold">Cliente</TableHeadCell>
		<TableHeadCell class="font-semibold">Cédula</TableHeadCell>
		<TableHeadCell class="font-semibold">Teléfono</TableHeadCell>
		<TableHeadCell class="font-semibold">Email</TableHeadCell>
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
	{/snippet}

	{#snippet actions(customer)}
		<ActionButton
			icon={Eye}
			title="Ver detalles y recetas"
			href={resolve(`/lenses/${customer.id}`)}
		/>

		<ActionButton
			icon={SquarePen}
			title="Editar cliente"
			color="blue"
			onclick={() => onEdit(customer)}
		/>
		<ActionButton
			icon={Trash2}
			title="Eliminar cliente"
			color="red"
			onclick={() => openDelete(customer)}
		/>
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
