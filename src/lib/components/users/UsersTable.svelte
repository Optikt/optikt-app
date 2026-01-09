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
	import { SquarePen, Trash2, Power, Users } from '@lucide/svelte';
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
					<TableBodyCell
						><span class="font-mono text-sm text-slate-600">@{user.username}</span></TableBodyCell
					>
					<TableBodyCell>
						<Badge color={getRoleBadgeColor(user.role)}>{user.role}</Badge>
					</TableBodyCell>
					<TableBodyCell>
						<Badge color={user.isActive ? 'green' : 'red'}>
							{user.isActive ? 'Activo' : 'Inactivo'}
						</Badge>
					</TableBodyCell>
					<TableBodyCell>
						<div class="flex items-center gap-1">
							<button
								onclick={() => onEdit(user)}
								class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-blue-50 hover:text-blue-600"
								title="Editar"
							>
								<SquarePen class="h-4 w-4" />
							</button>
							<button
								onclick={() => openToggle(user)}
								class={[
									'flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150',
									user.isActive
										? 'text-slate-500 hover:bg-amber-50 hover:text-amber-600'
										: 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
								]}
								title={user.isActive ? 'Desactivar' : 'Activar'}
							>
								<Power class="h-4 w-4" />
							</button>
							{#if !user.isSuperuser}
								<button
									onclick={() => openDelete(user)}
									class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
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
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 py-12 text-center"
	>
		<Users class="mb-3 h-10 w-10 text-slate-400" />
		<p class="text-sm font-medium text-slate-600">No se encontraron usuarios</p>
		<p class="mt-1 text-xs text-slate-400">Intenta ajustar los filtros de búsqueda</p>
	</div>
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
