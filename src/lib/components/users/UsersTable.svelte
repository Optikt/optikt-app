<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { SquarePen, Trash2, Power, Users } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteUserById } from '$lib/remote/users.remote';
	import { getErrorMessage } from '$lib/utils';
	import {
		DataTable,
		ActionButton,
		ConfirmModal,
		UserRoleBadge,
		StatusBadge
	} from '$lib/components/ui';
	import { ToggleActiveModal } from '$lib/components/users';
	import type { UserListItem } from '$lib/types';

	interface Props {
		users: UserListItem[];
		loading?: boolean;
		onEdit: (user: UserListItem) => void;
		onRefresh?: () => void;
	}

	let { users, loading = false, onEdit, onRefresh }: Props = $props();

	// Modal state
	let showToggleModal = $state(false);
	let showDeleteModal = $state(false);
	let selectedUser = $state<UserListItem | null>(null);
	let deleteLoading = $state(false);

	function openToggle(user: UserListItem) {
		selectedUser = user;
		showToggleModal = true;
	}

	function openDelete(user: UserListItem) {
		selectedUser = user;
		showDeleteModal = true;
	}

	async function handleDelete() {
		if (!selectedUser) return;

		deleteLoading = true;
		try {
			await deleteUserById({ id: selectedUser.id });
			toast.success('Usuario eliminado exitosamente');
			showDeleteModal = false;
			onRefresh?.();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error eliminando usuario'));
		} finally {
			deleteLoading = false;
		}
	}

	function handleToggleSuccess() {
		onRefresh?.();
	}
</script>

<DataTable
	items={users}
	{loading}
	emptyIcon={Users}
	emptyTitle="No se encontraron usuarios"
	emptyDescription="Intenta ajustar los filtros de búsqueda"
>
	{#snippet header()}
		<TableHeadCell class="font-semibold">Nombre</TableHeadCell>
		<TableHeadCell class="font-semibold">Email</TableHeadCell>
		<TableHeadCell class="font-semibold">Usuario</TableHeadCell>
		<TableHeadCell class="font-semibold">Rol</TableHeadCell>
		<TableHeadCell class="font-semibold">Estado</TableHeadCell>
	{/snippet}

	{#snippet row(user)}
		<TableBodyCell class="font-medium">{user.fullName}</TableBodyCell>
		<TableBodyCell>{user.email}</TableBodyCell>
		<TableBodyCell>
			<span class="font-mono text-sm text-slate-600">@{user.username}</span>
		</TableBodyCell>
		<TableBodyCell>
			<UserRoleBadge role={user.role} />
		</TableBodyCell>
		<TableBodyCell>
			<StatusBadge active={user.isActive} />
		</TableBodyCell>
	{/snippet}

	{#snippet actions(user)}
		<ActionButton icon={SquarePen} title="Editar" color="blue" onclick={() => onEdit(user)} />
		<ActionButton
			icon={Power}
			title={user.isActive ? 'Desactivar' : 'Activar'}
			color={user.isActive ? 'amber' : 'green'}
			onclick={() => openToggle(user)}
		/>
		<ActionButton
			icon={Trash2}
			title="Eliminar"
			color="red"
			hidden={user.isSuperuser}
			onclick={() => openDelete(user)}
		/>
	{/snippet}
</DataTable>

<!-- Toggle Active Modal -->
<ToggleActiveModal
	bind:open={showToggleModal}
	user={selectedUser}
	onSuccess={handleToggleSuccess}
/>

<!-- Delete Confirm Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Usuario"
	message="¿Está seguro que desea eliminar a {selectedUser?.fullName}? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDelete}
/>
