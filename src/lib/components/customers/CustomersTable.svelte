<script lang="ts">
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Spinner
	} from 'flowbite-svelte';
	import { SquarePen, Trash2, Eye, User } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteCustomerById } from '$lib/remote/customers.remote';
	import { getErrorMessage } from '$lib/utils';
	import { ConfirmModal } from '$lib/components/ui';
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

{#if loading}
	<div class="flex items-center justify-center py-12">
		<Spinner size="10" />
	</div>
{:else if customers.length > 0}
	<Table hoverable>
		<TableHead class="bg-slate-50">
			<TableHeadCell class="font-semibold">Cliente</TableHeadCell>
			<TableHeadCell class="font-semibold">Cédula</TableHeadCell>
			<TableHeadCell class="font-semibold">Teléfono</TableHeadCell>
			<TableHeadCell class="font-semibold">Email</TableHeadCell>
			<TableHeadCell class="text-right font-semibold">Acciones</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each customers as customer (customer.id)}
				<TableBodyRow class="hover:bg-slate-50">
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
						<span class="font-mono text-sm text-slate-600">
							{customer.idNumber ?? '—'}
						</span>
					</TableBodyCell>
					<TableBodyCell>
						<span class="text-slate-600">{customer.primaryPhone}</span>
					</TableBodyCell>
					<TableBodyCell>
						<span class="text-slate-600">{customer.email ?? '—'}</span>
					</TableBodyCell>
					<TableBodyCell class="text-right">
						<div class="flex justify-end gap-1">
							<button
								type="button"
								onclick={() => openView(customer)}
								class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-blue"
								title="Ver detalles"
							>
								<Eye class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => onEdit(customer)}
								class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600"
								title="Editar cliente"
							>
								<SquarePen class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => openDelete(customer)}
								class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
								title="Eliminar cliente"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
{:else}
	<div class="flex flex-col items-center justify-center py-16 text-center">
		<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
			<User class="h-8 w-8 text-slate-400" />
		</div>
		<p class="text-lg font-medium text-slate-600">No hay clientes</p>
		<p class="mt-1 text-sm text-slate-500">Agrega tu primer cliente para comenzar</p>
	</div>
{/if}

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
