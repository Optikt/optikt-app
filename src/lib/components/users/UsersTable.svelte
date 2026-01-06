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
	import { Edit, Trash2, Power } from '@lucide/svelte';
	import { UserRole } from '$lib/shared/enums';
	import type { UserListItem } from '$lib/types';

	interface Props {
		users: UserListItem[];
		loading?: boolean;
		onEdit: (user: UserListItem) => void;
		onToggleActive: (user: UserListItem) => void;
		onDelete: (user: UserListItem) => void;
	}

	let { users, loading = false, onEdit, onToggleActive, onDelete }: Props = $props();

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
								<Edit class="h-4 w-4" />
							</button>
							<button
								onclick={() => onToggleActive(user)}
								class={user.isActive
									? 'text-yellow-600 hover:text-yellow-800'
									: 'text-green-600 hover:text-green-800'}
								title={user.isActive ? 'Desactivar' : 'Activar'}
							>
								<Power class="h-4 w-4" />
							</button>
							{#if !user.isSuperuser}
								<button
									onclick={() => onDelete(user)}
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
