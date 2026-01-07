<script lang="ts">
	import { Button, Select, Checkbox } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SearchInput } from '$lib/components/ui';
	import { ALL_ROLES, UserRole } from '$lib/shared/enums';
	import {
		listUsers,
		createUser,
		updateUser,
		toggleUserActive,
		deleteUserById
	} from '$lib/remote/users.remote';
	import { UsersTable, UserFormModal, DeleteConfirmModal } from '$lib/components/users';
	import { untrack } from 'svelte';
	import type { UserListItem, PaginatedUsers } from '$lib/types/users';

	// SSR initial data
	let { data } = $props();

	let { initialUsers, totalCount } = untrack(() => data);

	// Data state - start with SSR data
	let usersData = $state<PaginatedUsers>({
		users: initialUsers,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	// Filter state
	let search = $state('');
	let roleFilter = $state<UserRole | ''>('');
	let includeInactive = $state(false);

	// Modal state
	let showFormModal = $state(false);
	let showDeleteModal = $state(false);
	let selectedUser = $state<UserListItem | null>(null);
	let formLoading = $state(false);
	let formError = $state<string | null>(null);

	// Fetch users with current filters (for interactions after initial load)
	async function fetchUsers(page = 1) {
		loading = true;
		try {
			usersData = await listUsers({
				page,
				perPage: 10,
				search: search || undefined,
				role: roleFilter || undefined,
				includeInactive
			});
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Error cargando usuarios');
		} finally {
			loading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchUsers(1), 300);
	}

	function handleFilterChange() {
		fetchUsers(1);
	}

	function goToPage(page: number) {
		fetchUsers(page);
	}

	// Modal handlers
	function openCreate() {
		selectedUser = null;
		formError = null;
		showFormModal = true;
	}

	function openEdit(user: UserListItem) {
		selectedUser = user;
		formError = null;
		showFormModal = true;
	}

	function openDelete(user: UserListItem) {
		selectedUser = user;
		showDeleteModal = true;
	}

	// CRUD handlers using remote functions
	async function handleFormSubmit(formData: FormData) {
		formLoading = true;
		formError = null;
		try {
			const isEdit = formData.has('id');
			if (isEdit) {
				await updateUser({
					id: formData.get('id') as string,
					fullName: formData.get('fullName') as string,
					username: formData.get('username') as string,
					email: formData.get('email') as string,
					password: (formData.get('password') as string) || undefined,
					role: formData.get('role') as UserRole,
					isActive: formData.get('isActive') === 'true'
				});
				toast.success('Usuario actualizado exitosamente');
			} else {
				await createUser({
					fullName: formData.get('fullName') as string,
					username: formData.get('username') as string,
					email: formData.get('email') as string,
					password: formData.get('password') as string,
					role: formData.get('role') as UserRole,
					isActive: formData.get('isActive') === 'true'
				});
				toast.success('Usuario creado exitosamente');
			}
			showFormModal = false;
			await fetchUsers(usersData.page);
		} catch (e) {
			formError = e instanceof Error ? e.message : 'Error guardando usuario';
		} finally {
			formLoading = false;
		}
	}

	async function handleToggleActive(user: UserListItem) {
		try {
			await toggleUserActive({ id: user.id });
			toast.success(user.isActive ? 'Usuario desactivado' : 'Usuario activado');
			await fetchUsers(usersData.page);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Error cambiando estado');
		}
	}

	async function handleDelete() {
		if (!selectedUser) return;
		formLoading = true;
		try {
			await deleteUserById({ id: selectedUser.id });
			showDeleteModal = false;
			toast.success('Usuario eliminado exitosamente');
			await fetchUsers(usersData.page);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Error eliminando usuario');
		} finally {
			formLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Usuarios - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold text-slate-900">Usuarios</h1>
			<p class="text-slate-600">Gestiona los usuarios del sistema</p>
		</div>
		<Button color="blue" onclick={openCreate}>
			<Plus class="mr-2 h-5 w-5" />
			Agregar Usuario
		</Button>
	</div>

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap items-center gap-4">
		<SearchInput
			bind:value={search}
			placeholder="Buscar por nombre, email o usuario..."
			oninput={handleSearch}
			class="max-w-md flex-1"
		/>
		<Select bind:value={roleFilter} onchange={handleFilterChange} class="w-40">
			<option value="">Todos los roles</option>
			{#each ALL_ROLES as role, index (`${role}-${index}`)}
				<option value={role}>{role}</option>
			{/each}
		</Select>
		<Checkbox bind:checked={includeInactive} onchange={handleFilterChange}>
			Incluir inactivos
		</Checkbox>
	</div>

	<!-- Table -->
	<UsersTable
		users={usersData.users}
		{loading}
		onEdit={openEdit}
		onToggleActive={handleToggleActive}
		onDelete={openDelete}
	/>

	<!-- Pagination -->
	{#if usersData.totalPages > 1}
		<div class="mt-4 flex items-center justify-between">
			<p class="text-sm text-gray-600">
				Mostrando {(usersData.page - 1) * 10 + 1} - {Math.min(usersData.page * 10, usersData.total)} de
				{usersData.total}
			</p>
			<div class="flex items-center gap-1">
				<Button
					size="sm"
					color="light"
					disabled={usersData.page === 1}
					onclick={() => goToPage(usersData.page - 1)}
				>
					Anterior
				</Button>
				{#each Array.from({ length: Math.min(5, usersData.totalPages) }, (_, i) => Math.max(1, usersData.page - 2) + i).filter((p) => p <= usersData.totalPages) as pageNum, index (`${pageNum}-${index}`)}
					<Button
						size="sm"
						color={pageNum === usersData.page ? 'blue' : 'light'}
						onclick={() => goToPage(pageNum)}
					>
						{pageNum}
					</Button>
				{/each}
				<Button
					size="sm"
					color="light"
					disabled={usersData.page === usersData.totalPages}
					onclick={() => goToPage(usersData.page + 1)}
				>
					Siguiente
				</Button>
			</div>
		</div>
	{/if}
</div>

<!-- Modals -->
<UserFormModal
	bind:open={showFormModal}
	user={selectedUser}
	loading={formLoading}
	error={formError}
	onSubmit={handleFormSubmit}
	onClose={() => (showFormModal = false)}
/>

<DeleteConfirmModal
	bind:open={showDeleteModal}
	userName={selectedUser?.fullName ?? ''}
	loading={formLoading}
	onConfirm={handleDelete}
	onCancel={() => (showDeleteModal = false)}
/>
