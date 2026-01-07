<script lang="ts">
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Badge,
		Spinner
	} from 'flowbite-svelte';
	import { SquarePen, Trash2, Power } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { deleteUserById } from '$lib/remote/users.remote';
	import { getErrorMessage } from '$lib/utils';
	import { ConfirmModal } from '$lib/components/ui';
	import { ToggleActiveModal } from '$lib/components/users';
	import { UserRole } from '$lib/shared/enums';
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

	function getRoleBadgeColor(role: UserRole): 'yellow' | 'purple' | 'blue' | 'green' | 'gray' {
		const colors: Record<UserRole, 'yellow' | 'purple' | 'blue' | 'green' | 'gray'> = {
			[UserRole.SUPERADMIN]: 'yellow',
			[UserRole.ADMIN]: 'purple',
			[UserRole.MANAGER]: 'blue',
			[UserRole.SELLER]: 'green',
			[UserRole.VIEWER]: 'gray'
		};
		return colors[role] ?? 'gray';
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-12">
		<Spinner size="10" />
	</div>
{:else if users.length > 0}
	<Table hoverable striped shadow>
		<TableHead>
			<TableHeadCell>Nombre</TableHeadCell>
			<TableHeadCell>Email</TableHeadCell>
			<TableHeadCell>Usuario</TableHeadCell>
			<TableHeadCell>Rol</TableHeadCell>
			<TableHeadCell>Estado</TableHeadCell>
			<TableHeadCell>Acciones</TableHeadCell>
		</TableHead>
		<TableBody>
			{#each users as user (user.id)}
				<TableBodyRow>
					<TableBodyCell class="font-medium">{user.fullName}</TableBodyCell>
					<TableBodyCell>{user.email}</TableBodyCell>
					<TableBodyCell>@{user.username}</TableBodyCell>
					<TableBodyCell>
						<Badge color={getRoleBadgeColor(user.role)}>{user.role}</Badge>
					</TableBodyCell>
					<TableBodyCell>
						<Badge color={user.isActive ? 'green' : 'red'}>
							{user.isActive ? 'Activo' : 'Inactivo'}
						</Badge>
					</TableBodyCell>
					<TableBodyCell>
						<div class="flex items-center gap-2">
							<button
								onclick={() => onEdit(user)}
								class="text-blue-600 hover:text-blue-800"
								title="Editar"
							>
								<SquarePen class="h-4 w-4" />
							</button>
							<button
								onclick={() => openToggle(user)}
								class={user.isActive
									? 'text-yellow-600 hover:text-yellow-800'
									: 'text-green-600 hover:text-green-800'}
								title={user.isActive ? 'Desactivar' : 'Activar'}
							>
								<Power class="h-4 w-4" />
							</button>
							{#if !user.isSuperuser}
								<button
									onclick={() => openDelete(user)}
									class="text-red-600 hover:text-red-800"
									title="Eliminar"
								>
									<Trash2 class="h-4 w-4" />
								</button>
							{/if}
						</div>
					</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
{:else}
	<div class="rounded-lg bg-gray-50 p-8 text-center text-gray-500">No se encontraron usuarios</div>
{/if}

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
