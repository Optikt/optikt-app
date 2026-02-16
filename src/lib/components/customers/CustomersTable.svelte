<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { SquarePen, Trash2, Eye, User } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteCustomerById } from '$lib/remote/customers.remote';
	import { getErrorMessage } from '$lib/utils';
	import { DataTable, ActionButton, ConfirmModal } from '$lib/components/ui';
	import { CustomerViewModal } from '$lib/components/customers';
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
	let showViewModal = $state(false);
	let selectedCustomer = $state<Customer | null>(null);
	let deleteLoading = $state(false);

	function openView(customer: Customer) {
		selectedCustomer = customer;
		showViewModal = true;
	}

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

	function getFullName(customer: Customer): string {
		return `${customer.firstName} ${customer.lastName}`;
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
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100"
				>
					<User class="h-5 w-5 text-primary-600" />
				</div>
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
		<ActionButton icon={Eye} title="Ver detalles" onclick={() => openView(customer)} />
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

<!-- View Modal -->
{#if selectedCustomer}
	<CustomerViewModal bind:open={showViewModal} customer={selectedCustomer} />
{/if}

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
