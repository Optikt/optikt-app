<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SearchInput, TablePagination } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { ALL_ROLES, UserRole } from '$lib/shared/enums';
	import { listUsers } from '$lib/remote/users.remote';
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
		showFormModal = true;
	}

	function openEdit(user: UserListItem) {
		selectedUser = user;
		showFormModal = true;
	}

	function handleFormSuccess() {
		showFormModal = false;
		fetchUsers(usersData.page);
	}

	function handleReactivate(candidate: UserListItem, formData: FormData) {
		reactivationCandidate = candidate;
		pendingFormData = formData;
		showReactivateModal = true;
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
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Usuarios</h1>
			<p class="text-slate-500">Gestiona los usuarios del sistema</p>
		</div>
		<Button onclick={openCreate}>
			<Plus class="mr-2 h-5 w-5" />
			Agregar Usuario
		</Button>
	</div>

	<!-- Filters -->
	<div
		class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
	>
		<SearchInput
			bind:value={search}
			placeholder="Buscar por nombre, email o usuario..."
			oninput={handleSearch}
			class="min-w-64 flex-1"
		/>
		<select bind:value={roleFilter} onchange={handleFilterChange} class="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue">
			<option value="">Todos los roles</option>
			{#each ALL_ROLES as role, index (`${role}-${index}`)}
				<option value={role}>{role}</option>
			{/each}
		</select>
		<label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={includeInactive} onchange={handleFilterChange} class="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-2 focus:ring-brand-blue" />
			Incluir inactivos
		</label>
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
	onSuccess={handleFormSuccess}
	onReactivate={handleReactivate}
	onClose={() => (showFormModal = false)}
/>

<!-- Reactivate Modal -->
<ReactivateConfirmModal
	bind:open={showReactivateModal}
	candidate={reactivationCandidate}
	formData={pendingFormData}
	onSuccess={handleReactivateSuccess}
/>
