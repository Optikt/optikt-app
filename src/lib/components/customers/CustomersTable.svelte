<script lang="ts">
	import { Eye, Trash2, RotateCcw, Users } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { deleteCustomerById } from '$lib/remote/customers.remote';
	import { getErrorMessage, getFullName } from '$lib/utils';
	import { ConfirmModal, DataGrid, StatusBadge } from '$lib/components/ui';
	import CustomerReactivateModal from './CustomerReactivateModal.svelte';
	import type { Customer } from '$lib/server/db/schema';

	interface Props {
		customers: Customer[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		canManage?: boolean;
		onRefresh?: () => void;
		onPageChange: (page: number) => void;
	}

	let {
		customers,
		page,
		perPage,
		total,
		totalPages,
		loading = false,
		canManage = true,
		onRefresh,
		onPageChange
	}: Props = $props();

	// Modal state
	let showDeleteModal = $state(false);
	let showReactivateModal = $state(false);
	let selectedCustomer = $state<Customer | null>(null);
	let deleteLoading = $state(false);

	const columns = [
		{ key: 'name', label: 'Cliente' },
		{ key: 'idNumber', label: 'Cédula' },
		{ key: 'phone', label: 'Teléfono' },
		{ key: 'email', label: 'Email' },
		{ key: 'status', label: 'Estado' },
		{ key: 'actions', label: 'Acciones', align: 'right' as const }
	];

	const avatarColors = [
		'bg-brand-blue/15 text-brand-blue',
		'bg-purple-container text-on-purple-container',
		'bg-success-container text-on-success-container',
		'bg-warning-container text-on-warning-container',
		'bg-info-container text-on-info-container',
		'bg-error-container text-on-error-container',
		'bg-brand-gold/20 text-brand-navy',
		'bg-brand-navy/10 text-brand-navy'
	];

	function getInitials(customer: Customer): string {
		return `${customer.firstName?.charAt(0) ?? ''}${customer.lastName?.charAt(0) ?? ''}`.toUpperCase();
	}

	function getAvatarColor(customer: Customer): string {
		const name = `${customer.firstName ?? ''}${customer.lastName ?? ''}`;
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
		}
		return avatarColors[Math.abs(hash) % avatarColors.length];
	}

	function openDelete(customer: Customer) {
		if (!canManage) return;

		selectedCustomer = customer;
		showDeleteModal = true;
	}

	function openReactivate(customer: Customer) {
		if (!canManage) return;

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

<DataGrid
	{columns}
	items={customers}
	{page}
	{perPage}
	{total}
	{totalPages}
	{loading}
	itemLabel="clientes"
	emptyTitle="No hay clientes"
	emptySubtitle="Agrega tu primer cliente para comenzar"
	{onPageChange}
>
	{#snippet emptyIcon()}
		<Users class="mb-3 h-10 w-10 text-outline" />
	{/snippet}

	{#snippet row(customer)}
		<tr
			class="cursor-pointer bg-surface-container-lowest transition-colors hover:bg-surface-container-low"
			onclick={() => goto(resolve(`/customers/${customer.id}`))}
		>
			<td class="px-4 py-3">
				<div class="flex items-center gap-3">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold {getAvatarColor(
							customer
						)}"
					>
						{getInitials(customer)}
					</div>
					<span class="font-medium text-on-surface">{getFullName(customer)}</span>
				</div>
			</td>
			<td class="px-4 py-3">
				<span class="font-mono text-sm text-on-surface-variant">{customer.idNumber ?? '-'}</span>
			</td>
			<td class="px-4 py-3">
				<span class="text-on-surface-variant">{customer.primaryPhone ?? '-'}</span>
			</td>
			<td class="px-4 py-3">
				<span class="text-on-surface-variant">{customer.email ?? '-'}</span>
			</td>
			<td class="px-4 py-3">
				<StatusBadge active={!customer.deletedAt} />
			</td>
			<td class="px-4 py-3 text-right">
				<div class="flex items-center justify-end gap-1">
					<button
						onclick={(e) => {
							e.stopPropagation();
							goto(resolve(`/customers/${customer.id}`));
						}}
						class="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-brand-blue"
						title="Ver detalles"
					>
						<Eye class="h-4 w-4" />
					</button>
					{#if canManage}
						{#if customer.deletedAt}
							<button
								onclick={(e) => {
									e.stopPropagation();
									openReactivate(customer);
								}}
								class="rounded-md p-1.5 text-on-surface-variant hover:bg-success-container hover:text-on-success-container"
								title="Reactivar"
							>
								<RotateCcw class="h-4 w-4" />
							</button>
						{:else}
							<button
								onclick={(e) => {
									e.stopPropagation();
									openDelete(customer);
								}}
								class="rounded-md p-1.5 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
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
