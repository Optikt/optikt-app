<script lang="ts">
	import {
		ArrowLeft,
		Plus,
		SquarePen,
		Phone,
		Mail,
		MapPin,
		Calendar,
		FileText,
		Star,
		ChevronDown,
		Trash2,
		Glasses,
		X,
		Check
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { slide } from 'svelte/transition';
	import {
		FormInput,
		FormTextarea,
		FormDatepicker,
		IdInput,
		ConfirmModal
	} from '$lib/components/ui';
	import { AppBadge, LensTypeBadge, TreatmentBadge } from '$lib/components/ui/badges';
	import { listPrescriptions, deletePrescriptionCommand } from '$lib/remote/prescriptions.remote';
	import { updateCustomerForm } from '$lib/remote/customers.remote';
	import {
		formatDate,
		formatOpticalValue,
		formatAxis,
		formatDpNp,
		getErrorMessage,
		getFullName,
		scrollToFirstError,
		toastUnboundErrors,
		dateFromUTC
	} from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
	import type { Prescription, Customer } from '$lib/server/db/schema';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let customer = $state<Customer>(untrack(() => data.customer));
	let prescriptions = $state<Prescription[]>(untrack(() => data.prescriptions));

	// Derived: current prescription
	const currentPrescription = $derived(prescriptions.find((p) => p.isCurrent) ?? null);

	// Inline editing state
	let isEditing = $state(false);
	let editLoading = $state(false);
	let formInstanceId = $state(generateUUID());
	let editData = $state({
		firstName: '',
		lastName: '',
		idNumber: '',
		birthDate: undefined as Date | undefined,
		primaryPhone: '',
		email: '',
		address: '',
		notes: ''
	});

	const today = new Date();
	const currentUpdateForm = $derived(updateCustomerForm.for(`${customer.id}-${formInstanceId}`));

	function startEditing() {
		formInstanceId = generateUUID();
		editData = {
			firstName: customer.firstName ?? '',
			lastName: customer.lastName ?? '',
			idNumber: customer.idNumber ?? '',
			birthDate: dateFromUTC(customer.birthDate),
			primaryPhone: customer.primaryPhone ?? '',
			email: customer.email ?? '',
			address: customer.address ?? '',
			notes: customer.notes ?? ''
		};
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
	}

	function goBack() {
		goto(resolve('/customers'));
	}

	// Prescriptions
	async function fetchPrescriptions() {
		try {
			prescriptions = await listPrescriptions({ customerId: customer.id });
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando fórmulas'));
		}
	}

	// Expandable prescription rows
	let expandedPrescriptionId = $state<string | null>(null);

	function toggleExpandPrescription(id: string) {
		expandedPrescriptionId = expandedPrescriptionId === id ? null : id;
	}

	// Delete prescription
	let showDeleteModal = $state(false);
	let deleteTarget = $state<Prescription | null>(null);
	let deleteLoading = $state(false);

	function openDeletePrescription(p: Prescription) {
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
			console.error(e);
			toast.error(getErrorMessage(e, 'Error eliminando fórmula'));
		} finally {
			deleteLoading = false;
		}
	}

	function getInitials(c: Customer): string {
		return `${c.firstName?.charAt(0) ?? ''}${c.lastName?.charAt(0) ?? ''}`.toUpperCase();
	}
</script>

<svelte:head>
	<title>{getFullName(customer)} - Optikt</title>
</svelte:head>

<div class="p-6">
	<!-- Back button -->
	<button
		onclick={goBack}
		class="mb-4 flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-brand-blue"
	>
		<ArrowLeft class="h-4 w-4" />
		Volver a clientes
	</button>

	<!-- Customer Profile Card -->
	<div class="mb-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
		{#if isEditing}
			<!-- EDIT MODE -->
			<form
				{...currentUpdateForm.enhance(async ({ submit }) => {
					editLoading = true;
					try {
						await submit();

						const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
						if (allIssues.length > 0) {
							scrollToFirstError();
							toastUnboundErrors(allIssues);
							return;
						}

						toast.success('Cliente actualizado exitosamente');
						isEditing = false;
						await invalidateAll();
						customer = data.customer;
					} catch (e) {
						console.error(e);
						toast.error(getErrorMessage(e, 'Error actualizando cliente'));
					} finally {
						editLoading = false;
					}
				})}
			>
				<input type="hidden" name="id" value={customer.id} />
				<div class="mb-5 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/15 text-lg font-bold text-brand-blue"
						>
							{getInitials(customer)}
						</div>
						<div>
							<h1
								class="font-[family-name:--font-family-heading] text-xl font-bold text-on-surface"
							>
								{getFullName(customer)}
							</h1>
							{#if customer.idNumber}
								<span class="font-mono text-sm text-on-surface-variant">{customer.idNumber}</span>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={cancelEditing}
							class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high"
						>
							<X class="h-4 w-4" />
							Cancelar
						</button>
						<button
							type="submit"
							disabled={editLoading}
							class="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy hover:shadow-md disabled:opacity-60"
						>
							{#if editLoading}
								<span
									class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
								></span>
							{:else}
								<Check class="h-4 w-4" />
							{/if}
							Guardar
						</button>
					</div>
				</div>

				<div class="space-y-4">
					<div class="grid gap-4 sm:grid-cols-2">
						<FormInput
							name="firstName"
							label="Nombre"
							required
							bind:value={editData.firstName}
							error={currentUpdateForm.fields.firstName?.issues()}
						/>
						<FormInput
							name="lastName"
							label="Apellido"
							required
							bind:value={editData.lastName}
							error={currentUpdateForm.fields.lastName?.issues()}
						/>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<IdInput
							name="idNumber"
							label="Cédula"
							bind:value={editData.idNumber}
							error={currentUpdateForm.fields.idNumber?.issues()}
						/>
						<FormDatepicker
							name="birthDate"
							label="Fecha de Nacimiento"
							required
							bind:value={editData.birthDate}
							availableTo={today}
							error={currentUpdateForm.fields.birthDate?.issues()}
						/>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<FormInput
							name="primaryPhone"
							label="Teléfono"
							type="tel"
							required
							placeholder="+58 412-1234567"
							bind:value={editData.primaryPhone}
							error={currentUpdateForm.fields.primaryPhone?.issues()}
						/>
						<FormInput
							name="email"
							label="Email"
							type="email"
							placeholder="cliente@email.com"
							bind:value={editData.email}
							error={currentUpdateForm.fields.email?.issues()}
						/>
					</div>
					<FormInput
						name="address"
						label="Dirección"
						placeholder="Av. Principal, Centro..."
						bind:value={editData.address}
					/>
					<FormTextarea
						name="notes"
						label="Notas"
						placeholder="Observaciones..."
						rows={2}
						bind:value={editData.notes}
					/>
				</div>
			</form>
		{:else}
			<!-- READ MODE -->
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-3">
					<div
						class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/15 text-lg font-bold text-brand-blue"
					>
						{getInitials(customer)}
					</div>
					<div>
						<h1 class="font-[family-name:--font-family-heading] text-xl font-bold text-on-surface">
							{getFullName(customer)}
						</h1>
						{#if customer.idNumber}
							<span class="font-mono text-sm text-on-surface-variant">{customer.idNumber}</span>
						{/if}
					</div>
				</div>
				<button
					onclick={startEditing}
					class="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/40 px-3 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-brand-blue hover:text-brand-blue"
				>
					<SquarePen class="h-4 w-4" />
					Editar
				</button>
			</div>

			<!-- Contact info grid -->
			<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div class="flex items-center gap-2 text-sm">
					<Phone class="h-4 w-4 text-outline" />
					<span class="text-on-surface-variant">{customer.primaryPhone ?? '—'}</span>
				</div>
				<div class="flex items-center gap-2 text-sm">
					<Mail class="h-4 w-4 text-outline" />
					<span class="text-on-surface-variant">{customer.email ?? '—'}</span>
				</div>
				{#if customer.birthDate}
					<div class="flex items-center gap-2 text-sm">
						<Calendar class="h-4 w-4 text-outline" />
						<span class="text-on-surface-variant">{formatDate(customer.birthDate)}</span>
					</div>
				{/if}
				{#if customer.address}
					<div class="flex items-center gap-2 text-sm">
						<MapPin class="h-4 w-4 text-outline" />
						<span class="text-on-surface-variant">{customer.address}</span>
					</div>
				{/if}
			</div>

			{#if customer.notes}
				<div class="mt-4 rounded-lg bg-surface-container-low p-3">
					<div class="flex items-start gap-2">
						<FileText class="mt-0.5 h-4 w-4 text-outline" />
						<p class="text-sm text-on-surface-variant">{customer.notes}</p>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Current Prescription Card -->
	{#if currentPrescription}
		<div
			class="mb-6 rounded-xl border border-l-4 border-outline-variant/30 border-l-brand-blue bg-surface-container-lowest p-6"
		>
			<div class="mb-3 flex items-center gap-2">
				<Star class="h-4 w-4 text-brand-gold" />
				<h2 class="text-sm font-semibold text-on-surface">Fórmula Actual</h2>
				<span class="text-xs text-on-surface-variant"
					>{formatDate(currentPrescription.prescriptionDate)}</span
				>
				{#if currentPrescription.recommendedLensType}
					<LensTypeBadge type={currentPrescription.recommendedLensType} />
				{/if}
			</div>

			<div class="grid gap-5 lg:grid-cols-2">
				<!-- OD -->
				<div class="rounded-lg bg-surface-container-low p-4">
					<div class="mb-2 flex items-center gap-2">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-[9px] font-bold text-white"
						>
							OD
						</div>
						<span class="text-xs font-semibold text-on-surface-variant">Ojo Derecho</span>
					</div>
					<p class="font-mono text-sm text-on-surface">
						{formatOpticalValue(currentPrescription.odSphere)}
						{formatOpticalValue(currentPrescription.odCylinder)}
						{#if currentPrescription.odAxis != null}x{currentPrescription.odAxis}°{/if}
					</p>
					{#if currentPrescription.odAddition != null}
						<p class="font-mono text-xs text-on-surface-variant">
							Add: {formatOpticalValue(currentPrescription.odAddition)}
						</p>
					{/if}
				</div>

				<!-- OS -->
				<div class="rounded-lg bg-surface-container-low p-4">
					<div class="mb-2 flex items-center gap-2">
						<div
							class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-[9px] font-bold text-white"
						>
							OS
						</div>
						<span class="text-xs font-semibold text-on-surface-variant">Ojo Izquierdo</span>
					</div>
					<p class="font-mono text-sm text-on-surface">
						{formatOpticalValue(currentPrescription.osSphere)}
						{formatOpticalValue(currentPrescription.osCylinder)}
						{#if currentPrescription.osAxis != null}x{currentPrescription.osAxis}°{/if}
					</p>
					{#if currentPrescription.osAddition != null}
						<p class="font-mono text-xs text-on-surface-variant">
							Add: {formatOpticalValue(currentPrescription.osAddition)}
						</p>
					{/if}
				</div>
			</div>

			<!-- Distances & Doctor -->
			<div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
				<span><strong>DP/NP:</strong> {formatDpNp(currentPrescription)}</span>
				{#if currentPrescription.doctorName}
					<span><strong>Doctor:</strong> {currentPrescription.doctorName}</span>
				{/if}
			</div>

			<!-- Treatments -->
			{#if currentPrescription.treatments}
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#if currentPrescription.treatments.antiReflective}
						<TreatmentBadge type="antiReflective" />
					{/if}
					{#if currentPrescription.treatments.blueBlock}
						<TreatmentBadge type="blueBlock" />
					{/if}
					{#if currentPrescription.treatments.photochromic}
						<TreatmentBadge type="photochromic" />
					{/if}
					{#if currentPrescription.treatments.other}
						<span
							class="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-medium text-on-surface-variant"
						>
							{currentPrescription.treatments.other}
						</span>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Prescriptions History Section -->
	<div class="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h2 class="font-[family-name:--font-family-heading] text-lg font-semibold text-on-surface">
					Fórmulas
				</h2>
				<p class="text-sm text-on-surface-variant">Historial de fórmulas del cliente</p>
			</div>
			<button
				onclick={() => goto(resolve(`/customers/${customer.id}/prescriptions/new`))}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-gold/30"
			>
				<Plus class="h-4 w-4" />
				Nueva Fórmula
			</button>
		</div>

		{#if prescriptions.length > 0}
			<div class="overflow-hidden rounded-xl border border-outline-variant/30">
				<table class="w-full">
					<thead>
						<tr class="bg-brand-navy">
							<th
								class="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest text-brand-gold uppercase"
								>Fecha</th
							>
							<th
								class="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest text-brand-gold uppercase"
								>Tipo</th
							>
							<th
								class="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest text-brand-gold uppercase"
								>OD</th
							>
							<th
								class="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest text-brand-gold uppercase"
								>OS</th
							>
							<th
								class="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest text-brand-gold uppercase"
								>Estado</th
							>
							<th
								class="px-4 py-2.5 text-right text-[10px] font-bold tracking-widest text-brand-gold uppercase"
								>Acciones</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-outline-variant/20">
						{#each prescriptions as prescription (prescription.id)}
							<!-- Row -->
							<tr
								class="group cursor-pointer bg-surface-container-lowest transition-colors hover:bg-surface-container-low"
								onclick={() => toggleExpandPrescription(prescription.id)}
							>
								<td class="px-4 py-3 text-sm font-medium whitespace-nowrap text-on-surface">
									{formatDate(prescription.prescriptionDate, { month: 'short' })}
								</td>
								<td class="px-4 py-3">
									{#if prescription.recommendedLensType}
										<LensTypeBadge type={prescription.recommendedLensType} />
									{:else}
										<span class="text-sm text-outline">—</span>
									{/if}
								</td>
								<td class="px-4 py-3 font-mono text-sm text-on-surface-variant">
									{formatOpticalValue(prescription.odSphere)}
									{formatOpticalValue(prescription.odCylinder)}
									{formatAxis(prescription.odAxis)}
								</td>
								<td class="px-4 py-3 font-mono text-sm text-on-surface-variant">
									{formatOpticalValue(prescription.osSphere)}
									{formatOpticalValue(prescription.osCylinder)}
									{formatAxis(prescription.osAxis)}
								</td>
								<td class="px-4 py-3">
									{#if prescription.isCurrent}
										<AppBadge variant="success">
											<Star class="h-3 w-3" />
											Actual
										</AppBadge>
									{:else}
										<span class="text-sm text-outline">—</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-1">
										<button
											onclick={(e) => {
												e.stopPropagation();
												goto(
													resolve(`/customers/${customer.id}/prescriptions/${prescription.id}/edit`)
												);
											}}
											class="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-brand-blue"
											title="Editar"
										>
											<SquarePen class="h-4 w-4" />
										</button>
										<button
											onclick={(e) => {
												e.stopPropagation();
												openDeletePrescription(prescription);
											}}
											class="rounded-md p-1.5 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
											title="Eliminar"
										>
											<Trash2 class="h-4 w-4" />
										</button>
										<div
											class="ml-1 transition-transform duration-200 {expandedPrescriptionId ===
											prescription.id
												? 'rotate-180'
												: ''}"
										>
											<ChevronDown class="h-4 w-4 text-on-surface-variant" />
										</div>
									</div>
								</td>
							</tr>
							<!-- Expanded detail -->
							{#if expandedPrescriptionId === prescription.id}
								<tr>
									<td colspan="6">
										<div
											transition:slide={{ duration: 200 }}
											class="bg-surface-container-low px-6 py-4"
										>
											<div class="grid gap-4 lg:grid-cols-2">
												<!-- OD Detail -->
												<div class="rounded-lg bg-surface-container-lowest p-4">
													<div class="mb-2 flex items-center gap-2">
														<div
															class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-navy text-[9px] font-bold text-white"
														>
															OD
														</div>
														<span class="text-xs font-semibold text-on-surface-variant"
															>Ojo Derecho</span
														>
													</div>
													<div class="grid grid-cols-4 gap-3 text-xs">
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Esfera</span
															>
															<p class="mt-0.5 font-mono text-sm text-on-surface">
																{formatOpticalValue(prescription.odSphere)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Cilindro</span
															>
															<p class="mt-0.5 font-mono text-sm text-on-surface">
																{formatOpticalValue(prescription.odCylinder)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Eje</span
															>
															<p class="mt-0.5 font-mono text-sm text-on-surface">
																{formatAxis(prescription.odAxis)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Adición</span
															>
															<p class="mt-0.5 font-mono text-sm text-on-surface">
																{formatOpticalValue(prescription.odAddition)}
															</p>
														</div>
													</div>
												</div>

												<!-- OS Detail -->
												<div class="rounded-lg bg-surface-container-lowest p-4">
													<div class="mb-2 flex items-center gap-2">
														<div
															class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-[9px] font-bold text-white"
														>
															OS
														</div>
														<span class="text-xs font-semibold text-on-surface-variant"
															>Ojo Izquierdo</span
														>
													</div>
													<div class="grid grid-cols-4 gap-3 text-xs">
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Esfera</span
															>
															<p class="mt-0.5 font-mono text-sm text-on-surface">
																{formatOpticalValue(prescription.osSphere)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Cilindro</span
															>
															<p class="mt-0.5 font-mono text-sm text-on-surface">
																{formatOpticalValue(prescription.osCylinder)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Eje</span
															>
															<p class="mt-0.5 font-mono text-sm text-on-surface">
																{formatAxis(prescription.osAxis)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Adición</span
															>
															<p class="mt-0.5 font-mono text-sm text-on-surface">
																{formatOpticalValue(prescription.osAddition)}
															</p>
														</div>
													</div>
												</div>
											</div>

											<!-- Distances, Doctor, Treatments, Notes -->
											<div
												class="mt-4 flex flex-wrap items-center gap-4 text-xs text-on-surface-variant"
											>
												<span><strong>DP/NP:</strong> {formatDpNp(prescription)}</span>
												{#if prescription.doctorName}
													<span><strong>Doctor:</strong> {prescription.doctorName}</span>
												{/if}
											</div>

											{#if prescription.treatments}
												<div class="mt-3 flex flex-wrap gap-1.5">
													{#if prescription.treatments.antiReflective}
														<TreatmentBadge type="antiReflective" />
													{/if}
													{#if prescription.treatments.blueBlock}
														<TreatmentBadge type="blueBlock" />
													{/if}
													{#if prescription.treatments.photochromic}
														<TreatmentBadge type="photochromic" />
													{/if}
													{#if prescription.treatments.other}
														<span
															class="rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-medium text-on-surface-variant"
														>
															{prescription.treatments.other}
														</span>
													{/if}
												</div>
											{/if}

											{#if prescription.notes}
												<div class="mt-3 rounded-lg bg-surface-container p-3">
													<div class="flex items-start gap-2">
														<FileText class="mt-0.5 h-3.5 w-3.5 text-outline" />
														<p class="text-xs text-on-surface-variant">{prescription.notes}</p>
													</div>
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div
				class="flex flex-col items-center justify-center rounded-xl border border-outline-variant/30 bg-surface py-12 text-center"
			>
				<Glasses class="mb-3 h-10 w-10 text-outline" />
				<p class="font-medium text-on-surface-variant">No hay fórmulas registradas</p>
				<p class="mt-1 text-sm text-outline">Agrega una fórmula para comenzar</p>
			</div>
		{/if}
	</div>
</div>

<!-- Delete Prescription Modal -->
<ConfirmModal
	bind:open={showDeleteModal}
	title="Eliminar Fórmula"
	message="¿Estás seguro de que deseas eliminar esta fórmula? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	confirmColor="red"
	loading={deleteLoading}
	onConfirm={handleDeletePrescription}
/>
