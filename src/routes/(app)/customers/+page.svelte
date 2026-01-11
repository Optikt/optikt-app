<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { SearchInput, TablePagination, ConfirmModal } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { listCustomers, reactivateCustomer } from '$lib/remote/customers.remote';
	import { CustomersTable, CustomerFormModal } from '$lib/components/customers';
	import type { Customer } from '$lib/server/db/schema';
	import type { PaginatedCustomers } from '$lib/remote/customers.remote';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialCustomers, totalCount } = untrack(() => data);

	// Data state - initialize from server
	let customersData = $state<PaginatedCustomers>({
		customers: initialCustomers as Customer[],
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	// Filter state
	let search = $state('');

	// Form modal state
	let showFormModal = $state(false);
	let selectedCustomer = $state<Customer | null>(null);

	// Reactivation modal state
	let showReactivateModal = $state(false);
	let reactivateCandidate = $state<Customer | null>(null);
	let reactivateFormData = $state<FormData | null>(null);
	let reactivateLoading = $state(false);

	// Fetch customers (for filtering/pagination)
	async function fetchCustomers(page = 1) {
		loading = true;
		try {
			customersData = await listCustomers({
				page,
				perPage: 10,
				search: search || undefined
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

	function handleFormSuccess() {
		showFormModal = false;
		fetchCustomers(customersData.page);
	}

	// Reactivation handlers
	function handleReactivate(candidate: Customer, formData: FormData) {
		reactivateCandidate = candidate;
		reactivateFormData = formData;
		showFormModal = false;
		showReactivateModal = true;
	}

	async function confirmReactivate() {
		if (!reactivateCandidate || !reactivateFormData) return;

		reactivateLoading = true;
		try {
			// Build reactivation data from formData
			await reactivateCustomer({
				id: reactivateCandidate.id,
				firstName: reactivateFormData.get('firstName') as string,
				lastName: reactivateFormData.get('lastName') as string,
				idNumber: (reactivateFormData.get('idNumber') as string) || undefined,
				birthDate: (reactivateFormData.get('birthDate') as string) || undefined,
				primaryPhone: reactivateFormData.get('primaryPhone') as string,
				email: (reactivateFormData.get('email') as string) || undefined,
				address: (reactivateFormData.get('address') as string) || undefined,
				notes: (reactivateFormData.get('notes') as string) || undefined
			});

			toast.success('Cliente reactivado exitosamente');
			showReactivateModal = false;
			fetchCustomers(1);
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error reactivando cliente'));
		} finally {
			reactivateLoading = false;
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
	<div class="mb-6">
		<SearchInput
			bind:value={search}
			placeholder="Buscar por nombre, cédula, teléfono..."
			oninput={handleSearch}
			class="w-full max-w-md"
		/>
	</div>

	<!-- Table -->
	<div class="glass-card overflow-hidden">
		<CustomersTable
			customers={customersData.customers}
			{loading}
			onEdit={openEdit}
			onRefresh={() => fetchCustomers(customersData.page)}
		/>

		{#if customersData.totalPages > 1}
			<div class="border-t p-4">
				<TablePagination
					page={customersData.page}
					perPage={customersData.perPage}
					total={customersData.total}
					totalPages={customersData.totalPages}
					onPageChange={fetchCustomers}
				/>
			</div>
		{/if}
	</div>
</div>

<!-- Form Modal -->
<CustomerFormModal
	bind:open={showFormModal}
	customer={selectedCustomer}
	onSuccess={handleFormSuccess}
	onReactivate={handleReactivate}
	onClose={() => (showFormModal = false)}
/>

<!-- Reactivate Confirmation -->
<ConfirmModal
	bind:open={showReactivateModal}
	title="Reactivar Cliente"
	message="Ya existe un cliente eliminado con esta cédula: {reactivateCandidate?.firstName} {reactivateCandidate?.lastName}. ¿Deseas reactivarlo con los nuevos datos?"
	confirmLabel="Reactivar"
	confirmColor="blue"
	loading={reactivateLoading}
	onConfirm={confirmReactivate}
/>
