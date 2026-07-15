<script lang="ts">
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
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Nombre</th
		>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Email</th
		>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Usuario</th
		>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Rol</th
		>
		<th class="font-semibold px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500"
			>Estado</th
		>
	{/snippet}

	{#snippet row(user)}
		<td class="font-medium px-4 py-3 text-sm">{user.fullName}</td>
		<td class="px-4 py-3 text-sm">{user.email}</td>
		<td class="px-4 py-3 text-sm">
			<span class="font-mono text-sm text-slate-600">@{user.username}</span>
		</td>
		<td class="px-4 py-3 text-sm">
			<UserRoleBadge role={user.role} />
		</td>
		<td class="px-4 py-3 text-sm">
			<StatusBadge active={user.isActive} />
		</td>
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
