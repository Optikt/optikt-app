<script lang="ts">
	import { Button, Toggle } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SearchInput, TablePagination } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { listCustomers } from '$lib/remote/customers.remote';
	import { CustomersTable, CustomerFormModal } from '$lib/components/customers';
	import type { Customer } from '$lib/server/db/schema';
	import type { PaginatedResult } from '$lib/types';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialCustomers, totalCount } = untrack(() => data);

	// Data state - initialize from server
	let customersData = $state<PaginatedResult<Customer>>({
		items: initialCustomers,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	// Filter state
	let search = $state('');
	let includeDeleted = $state(false);

	// Form modal state
	let showFormModal = $state(false);
	let selectedCustomer = $state<Customer | null>(null);

	// Fetch customers (for filtering/pagination)
	async function fetchCustomers(page = 1) {
		loading = true;
		try {
			customersData = await listCustomers({
				page,
				perPage: 10,
				search: search || undefined,
				includeDeleted
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando clientes'));
		} finally {
			loading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchCustomers(1), 300);
	}

	// Modal handlers
	function openCreate() {
		selectedCustomer = null;
		showFormModal = true;
	}

	function openEdit(customer: Customer) {
		selectedCustomer = customer;
		showFormModal = true;
	}

	function handleFormSuccess(createdCustomerId?: string) {
		showFormModal = false;
		if (createdCustomerId) {
			// Redirect to the new customer's detail page
			goto(resolve(`/customers/${createdCustomerId}`));
		} else {
			// Just refresh the list (for edits)
			fetchCustomers(customersData.page);
		}
	}
</script>

<svelte:head>
	<title>Clientes - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-900">Clientes</h1>
			<p class="text-slate-500">Gestión de clientes de la óptica</p>
		</div>
		<Button color="blue" onclick={openCreate}>
			<Plus class="mr-2 h-4 w-4" />
			Agregar Cliente
		</Button>
	</div>

	<!-- Filters -->
	<div
		class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
	>
		<SearchInput
			bind:value={search}
			placeholder="Buscar por nombre, cédula, teléfono..."
			oninput={handleSearch}
			class="min-w-64 flex-1"
		/>
		<Toggle
			bind:checked={includeDeleted}
			onchange={() => fetchCustomers(1)}
			class="text-sm text-slate-600"
		>
			Mostrar eliminados
		</Toggle>
	</div>

	<!-- Table -->
	<CustomersTable
		customers={customersData.items}
		{loading}
		onEdit={openEdit}
		onRefresh={() => fetchCustomers(customersData.page)}
	/>

	<!-- Pagination -->
	<TablePagination
		page={customersData.page}
		perPage={customersData.perPage}
		total={customersData.total}
		totalPages={customersData.totalPages}
		onPageChange={fetchCustomers}
	/>
</div>

<!-- Form Modal -->
<CustomerFormModal
	bind:open={showFormModal}
	customer={selectedCustomer}
	onSuccess={handleFormSuccess}
	onClose={() => (showFormModal = false)}
/>
