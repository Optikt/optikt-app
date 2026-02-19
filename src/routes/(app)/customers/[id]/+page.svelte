<script lang="ts">
	import { Button, Badge } from 'flowbite-svelte';
	import {
		ArrowLeft,
		Plus,
		SquarePen,
		Phone,
		Mail,
		MapPin,
		Calendar,
		FileText,
		Star
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { listPrescriptions } from '$lib/remote/prescriptions.remote';
	import {
		formatDate,
		formatLensType,
		formatOpticalValue,
		getErrorMessage,
		getFullName
	} from '$lib/utils';
	import {
		PrescriptionsTable,
		PrescriptionFormModal,
		PrescriptionViewModal
	} from '$lib/components/prescriptions';
	import { CustomerFormModal } from '$lib/components/customers';
	import type { Prescription, Customer } from '$lib/server/db/schema';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let customer = $state<Customer>(untrack(() => data.customer));
	let prescriptions = $state<Prescription[]>(untrack(() => data.prescriptions));

	// Derived: current prescription
	const currentPrescription = $derived(prescriptions.find((p) => p.isCurrent) ?? null);

	// Modal state
	let showPrescriptionForm = $state(false);
	let showPrescriptionView = $state(false);
	let showEditCustomer = $state(false);
	let selectedPrescription = $state<Prescription | null>(null);

	// Fetch prescriptions
	async function fetchPrescriptions() {
		try {
			prescriptions = await listPrescriptions({ customerId: customer.id });
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando fórmulas'));
		}
	}

	// Refresh customer data after edit
	async function handleCustomerEditSuccess() {
		showEditCustomer = false;
		await invalidateAll();
		// Update local state from refreshed server data
		customer = data.customer;
	}

	// Prescription modal handlers
	function openCreatePrescription() {
		selectedPrescription = null;
		showPrescriptionForm = true;
	}

	function openViewPrescription(prescription: Prescription) {
		selectedPrescription = prescription;
		showPrescriptionView = true;
	}

	function openEditPrescription(prescription: Prescription) {
		selectedPrescription = prescription;
		showPrescriptionView = false;
		showPrescriptionForm = true;
	}

	function handlePrescriptionFormSuccess() {
		showPrescriptionForm = false;
		fetchPrescriptions();
	}

	function handlePrescriptionDeleted() {
		fetchPrescriptions();
	}

	// TODO: Create a share component for GoBack
	function goBack() {
		goto(resolve('/customers'));
	}
</script>

<svelte:head>
	<title>{getFullName(customer)} - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Back button -->
	<button
		onclick={goBack}
		class="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
	>
		<ArrowLeft class="h-4 w-4" />
		Volver a clientes
	</button>

	<!-- Customer Header -->
	<div class="mb-6 rounded-lg border border-slate-200 bg-white p-6">
		<div class="flex items-start justify-between">
			<div class="flex items-center gap-4">
				<div
					class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xl font-semibold text-primary-600"
				>
					{customer.firstName?.charAt(0) ?? 'C'}
				</div>
				<div>
					<h1 class="text-2xl font-bold text-slate-900">
						{getFullName(customer)}
					</h1>
					{#if customer.idNumber}
						<p class="mt-0.5 font-mono text-sm text-slate-500">{customer.idNumber}</p>
					{/if}
				</div>
			</div>
			<Button color="light" onclick={() => (showEditCustomer = true)}>
				<SquarePen class="mr-2 h-4 w-4" />
				Editar
			</Button>
		</div>

		<!-- Contact info grid -->
		<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="flex items-center gap-2 text-sm">
				<Phone class="h-4 w-4 text-slate-400" />
				<span class="text-slate-600">{customer.primaryPhone ?? '—'}</span>
			</div>
			<div class="flex items-center gap-2 text-sm">
				<Mail class="h-4 w-4 text-slate-400" />
				<span class="text-slate-600">{customer.email ?? '—'}</span>
			</div>
			{#if customer.birthDate}
				<div class="flex items-center gap-2 text-sm">
					<Calendar class="h-4 w-4 text-slate-400" />
					<span class="text-slate-600">{formatDate(customer.birthDate)}</span>
				</div>
			{/if}
			{#if customer.address}
				<div class="flex items-center gap-2 text-sm">
					<MapPin class="h-4 w-4 text-slate-400" />
					<span class="text-slate-600">{customer.address}</span>
				</div>
			{/if}
		</div>

		{#if customer.notes}
			<div class="mt-4 rounded-lg bg-slate-50 p-3">
				<div class="flex items-start gap-2">
					<FileText class="mt-0.5 h-4 w-4 text-slate-400" />
					<p class="text-sm text-slate-600">{customer.notes}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Current Prescription Summary -->
	{#if currentPrescription}
		<div class="mb-6 rounded-lg border border-green-200 bg-green-50/50 p-6">
			<div class="mb-3 flex items-center gap-2">
				<Star class="h-4 w-4 text-green-600" />
				<h2 class="text-sm font-semibold text-green-800">Fórmula Actual</h2>
				<span class="text-xs text-green-600">
					{formatDate(currentPrescription.prescriptionDate)}
				</span>
				{#if currentPrescription.recommendedLensType}
					<Badge color="green" class="text-xs">
						{formatLensType(currentPrescription.recommendedLensType)}
					</Badge>
				{/if}
			</div>
			<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
				<!-- OD Summary -->
				<div>
					<p class="mb-1 text-xs font-medium text-slate-500">OD (Derecho)</p>
					<p class="font-mono text-sm text-slate-900">
						{formatOpticalValue(currentPrescription.odSphere)}
						{formatOpticalValue(currentPrescription.odCylinder)}
						{#if currentPrescription.odAxis != null}x{currentPrescription.odAxis}°{/if}
					</p>
					{#if currentPrescription.odAddition != null}
						<p class="font-mono text-xs text-slate-600">
							Add: {formatOpticalValue(currentPrescription.odAddition)}
						</p>
					{/if}
				</div>
				<!-- OS Summary -->
				<div>
					<p class="mb-1 text-xs font-medium text-slate-500">OS (Izquierdo)</p>
					<p class="font-mono text-sm text-slate-900">
						{formatOpticalValue(currentPrescription.osSphere)}
						{formatOpticalValue(currentPrescription.osCylinder)}
						{#if currentPrescription.osAxis != null}x{currentPrescription.osAxis}°{/if}
					</p>
					{#if currentPrescription.osAddition != null}
						<p class="font-mono text-xs text-slate-600">
							Add: {formatOpticalValue(currentPrescription.osAddition)}
						</p>
					{/if}
				</div>
				<!-- PD -->
				<div>
					<p class="mb-1 text-xs font-medium text-slate-500">PD</p>
					<p class="font-mono text-sm text-slate-900">
						{#if currentPrescription.pd}
							{currentPrescription.pd}mm
						{:else if currentPrescription.pdRight && currentPrescription.pdLeft}
							{currentPrescription.pdRight}/{currentPrescription.pdLeft}mm
						{:else}
							—
						{/if}
					</p>
				</div>
				<!-- Doctor -->
				<div>
					<p class="mb-1 text-xs font-medium text-slate-500">Doctor</p>
					<p class="text-sm text-slate-900">{currentPrescription.doctorName ?? '—'}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Prescriptions Section -->
	<div class="rounded-lg border border-slate-200 bg-white p-6">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-slate-900">Fórmulas</h2>
				<p class="text-sm text-slate-500">Historial de fórmulas del cliente</p>
			</div>
			<Button color="blue" onclick={openCreatePrescription}>
				<Plus class="mr-2 h-4 w-4" />
				Nueva Fórmula
			</Button>
		</div>

		<PrescriptionsTable
			{prescriptions}
			onView={openViewPrescription}
			onEdit={openEditPrescription}
		/>
	</div>
</div>

<!-- Customer Edit Modal -->
<CustomerFormModal
	bind:open={showEditCustomer}
	{customer}
	onSuccess={handleCustomerEditSuccess}
	onClose={() => (showEditCustomer = false)}
/>

<!-- Prescription Form Modal -->
<PrescriptionFormModal
	bind:open={showPrescriptionForm}
	{customer}
	prescription={selectedPrescription}
	onSuccess={handlePrescriptionFormSuccess}
	onClose={() => (showPrescriptionForm = false)}
/>

<!-- Prescription View Modal -->
<PrescriptionViewModal
	bind:open={showPrescriptionView}
	prescription={selectedPrescription}
	{customer}
	onEdit={() => openEditPrescription(selectedPrescription!)}
	onDeleted={handlePrescriptionDeleted}
	onClose={() => (showPrescriptionView = false)}
/>
