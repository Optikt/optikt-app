<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { listPrescriptions, deletePrescriptionCommand } from '$lib/remote/prescriptions.remote';
	import { updateCustomerForm } from '$lib/remote/customers.remote';
	import { getErrorMessage, getFullName, peekBackUrl } from '$lib/utils';
	import { canOperate } from '$lib/shared/enums';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { nowUTC } from '$lib/dates';
	import type { Prescription, Customer } from '$lib/server/db/schema';
	import { untrack } from 'svelte';
	import CustomerDetailHeader from '$lib/components/customers/detail/CustomerDetailHeader.svelte';
	import CustomerInfoCard from '$lib/components/customers/detail/CustomerInfoCard.svelte';
	import ActivePrescriptionCard from '$lib/components/customers/detail/ActivePrescriptionCard.svelte';
	import CustomerHistorySection, {
		type CustomerHistoryTab
	} from '$lib/components/customers/detail/CustomerHistorySection.svelte';
	import {
		buildCustomerEditData,
		findCurrentPrescription,
		toggleExpandedId,
		type CustomerEditData
	} from '$lib/components/customers/detail/customerDetail';

	// Server data
	let { data } = $props();
	let customer = $state<Customer>(untrack(() => data.customer));
	let prescriptions = $state<Prescription[]>(untrack(() => data.prescriptions));
	const customerSales = untrack(() => data.customerSales);
	const customerQuotes = untrack(() => data.customerQuotes);
	const canAct = $derived(canOperate(data.user.role));
	const backHref = peekBackUrl('/customers');

	// State for the active history tab
	let activeTab = $state<CustomerHistoryTab>('prescriptions');

	// Derived: current prescription
	const currentPrescription = $derived(findCurrentPrescription(prescriptions));

	// Inline editing state
	let isEditing = $state(false);
	let editLoading = $state(false);
	let formInstanceId = $state(generateUUID());
	let editData = $state<CustomerEditData>(buildCustomerEditData(untrack(() => data.customer)));

	const today = nowUTC();
	const currentUpdateForm = $derived(updateCustomerForm.for(`${customer.id}-${formInstanceId}`));

	function startEditing() {
		if (!canAct) return;

		formInstanceId = generateUUID();
		editData = buildCustomerEditData(customer);
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
	}

	// Prescriptions
	async function fetchPrescriptions() {
		try {
			prescriptions = await listPrescriptions({ customerId: customer.id });
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando fórmulas'));
		}
	}

	// Expandable prescription rows
	let expandedPrescriptionId = $state<string | null>(null);

	function toggleExpandPrescription(id: string) {
		expandedPrescriptionId = toggleExpandedId(expandedPrescriptionId, id);
	}

	// Delete prescription
	let showDeleteModal = $state(false);
	let deleteTarget = $state<Prescription | null>(null);
	let deleteLoading = $state(false);

	function openDeletePrescription(p: Prescription) {
		if (!canAct) return;

		deleteTarget = p;
		showDeleteModal = true;
	}

	async function handleDeletePrescription() {
		if (!deleteTarget) return;
		deleteLoading = true;
		try {
			await deletePrescriptionCommand({ id: deleteTarget.id });
			toast.success('Fórmula eliminada exitosamente');
			showDeleteModal = false;
			deleteTarget = null;
			fetchPrescriptions();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error eliminando fórmula'));
		} finally {
			deleteLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{getFullName(customer)} - Optikt</title>
</svelte:head>

<div class="p-6">
	<CustomerDetailHeader {customer} {backHref} />

	<div class="grid gap-6 lg:grid-cols-5">
		<div class="lg:col-span-3">
			<CustomerInfoCard
				{customer}
				{isEditing}
				{canAct}
				bind:editData
				bind:editLoading
				updateForm={currentUpdateForm}
				{today}
				onStartEdit={startEditing}
				onCancelEdit={cancelEditing}
				onSaved={() => {
					isEditing = false;
					customer = data.customer;
				}}
			/>
		</div>

		<div class="lg:col-span-2">
			<ActivePrescriptionCard
				prescription={currentPrescription}
				{canAct}
				customerId={customer.id}
			/>
		</div>
	</div>

	<CustomerHistorySection
		bind:activeTab
		{prescriptions}
		{customerSales}
		{customerQuotes}
		{canAct}
		customerId={customer.id}
		bind:expandedId={expandedPrescriptionId}
		onToggleExpand={toggleExpandPrescription}
		onDeleteRx={openDeletePrescription}
		bind:showDeleteModal
		{deleteLoading}
		onConfirmDelete={handleDeletePrescription}
	/>
</div>
