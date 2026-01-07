<script lang="ts">
	import { Button, Select, Checkbox } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SearchInput, TablePagination } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { ALL_ROLES, UserRole } from '$lib/shared/enums';
	import { listUsers, createUser, updateUser } from '$lib/remote/users.remote';
	import { UsersTable, UserFormModal, ReactivateConfirmModal } from '$lib/components/users';
	import { untrack } from 'svelte';
	import type { UserListItem, PaginatedUsers } from '$lib/types/users';

	// SSR initial data (untrack since is initial data)
	let { data } = $props();
	let { initialUsers, totalCount } = untrack(() => data);

	// Data state
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

	// Form modal state
	let showFormModal = $state(false);
	let selectedUser = $state<UserListItem | null>(null);
	let formLoading = $state(false);
	let formError = $state<string | null>(null);

	// Reactivation modal state
	let showReactivateModal = $state(false);
	let pendingFormData = $state<FormData | null>(null);
	let reactivationCandidate = $state<UserListItem | null>(null);

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
			toast.error(getErrorMessage(e, 'Error cargando usuarios'));
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

	async function handleFormSubmit(formData: FormData) {
		formLoading = true;
		formError = null;
		try {
			const isEdit = formData.has('id') && formData.get('id');
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
				showFormModal = false;
				await fetchUsers(usersData.page);
			} else {
				const result = await createUser({
					fullName: formData.get('fullName') as string,
					username: formData.get('username') as string,
					email: formData.get('email') as string,
					password: formData.get('password') as string,
					role: formData.get('role') as UserRole,
					isActive: formData.get('isActive') === 'true'
				});

				if (result.success) {
					toast.success('Usuario creado exitosamente');
					showFormModal = false;
					await fetchUsers(usersData.page);
				} else {
					// Reactivation candidate found
					pendingFormData = formData;
					reactivationCandidate = result.reactivationCandidate;
					showReactivateModal = true;
				}
			}
		} catch (e) {
			const message = getErrorMessage(e, 'Error guardando usuario');
			formError = message;
			toast.error(message);
		} finally {
			formLoading = false;
		}
	}

	function handleReactivateSuccess() {
		showReactivateModal = false;
		showFormModal = false;
		pendingFormData = null;
		reactivationCandidate = null;
		fetchUsers(usersData.page);
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
		onRefresh={() => fetchUsers(usersData.page)}
	/>

	<!-- Pagination -->
	<TablePagination
		page={usersData.page}
		perPage={usersData.perPage}
		total={usersData.total}
		totalPages={usersData.totalPages}
		onPageChange={(p) => fetchUsers(p)}
	/>
</div>

<!-- Create/Update Form Modal -->
<UserFormModal
	bind:open={showFormModal}
	user={selectedUser}
	loading={formLoading}
	error={formError}
	onSubmit={handleFormSubmit}
	onClose={() => (showFormModal = false)}
/>

<!-- Reactivate Modal -->
<ReactivateConfirmModal
	bind:open={showReactivateModal}
	candidate={reactivationCandidate}
	formData={pendingFormData}
	onSuccess={handleReactivateSuccess}
/>
