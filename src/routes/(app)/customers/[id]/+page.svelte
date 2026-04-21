<script lang="ts">
	import {
		Plus,
		SquarePen,
		FileText,
		Star,
		ChevronDown,
		Trash2,
		Glasses,
		X,
		Check,
		ArrowLeft,
		User,
		ShoppingBag
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
	import {
		AppBadge,
		LensTypeBadge,
		TreatmentBadge,
		SaleStatusBadge
	} from '$lib/components/ui/badges';
	import { listPrescriptions, deletePrescriptionCommand } from '$lib/remote/prescriptions.remote';
	import { updateCustomerForm } from '$lib/remote/customers.remote';
	import {
		formatDate,
		formatOpticalValue,
		formatAxis,
		formatDpNp,
		formatCurrency,
		getErrorMessage,
		getFullName,
		scrollToFirstError,
		toastUnboundErrors,
		parseISODateToLocal
	} from '$lib/utils';
	import { canOperate } from '$lib/shared/enums';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { nowUTC } from '$lib/dates';
	import type { Prescription, Customer } from '$lib/server/db/schema';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let customer = $state<Customer>(untrack(() => data.customer));
	let prescriptions = $state<Prescription[]>(untrack(() => data.prescriptions));
	const recentSales = untrack(() => data.recentSales) as SaleWithRelations[];
	const canAct = $derived(canOperate(data.user.role));

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

	const today = nowUTC();
	const currentUpdateForm = $derived(updateCustomerForm.for(`${customer.id}-${formInstanceId}`));

	function startEditing() {
		if (!canAct) return;

		formInstanceId = generateUUID();
		editData = {
			firstName: customer.firstName ?? '',
			lastName: customer.lastName ?? '',
			idNumber: customer.idNumber ?? '',
			birthDate: parseISODateToLocal(customer.birthDate),
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

	function scrollPrescriptionIntoView(e: Event) {
		(e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
	<!-- Back link -->
	<!-- eslint-disable-next-line svelte/valid-compile -->
	<a
		href={resolve('/customers' as '/')}
		class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-brand-blue"
	>
		<ArrowLeft class="h-4 w-4" />
		Volver a clientes
	</a>

	<!-- Profile Header -->
	<div class="mb-6 flex items-center gap-4">
		<div class="flex items-center gap-4">
			<div
				class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/15 text-2xl font-bold text-brand-blue"
			>
				{getInitials(customer)}
			</div>
			<div>
				<h1 class="font-heading text-3xl font-bold text-brand-navy">
					{getFullName(customer)}
				</h1>
				{#if customer.idNumber}
					<span
						class="mt-1 inline-block rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-sm text-on-surface-variant"
					>
						{customer.idNumber}
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Two-Column Layout -->
	<div class="grid gap-6 lg:grid-cols-5">
		<!-- LEFT COLUMN: Personal Info -->
		<div class="lg:col-span-3">
			{#if isEditing}
				<!-- EDIT MODE -->
				<div class="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
					<div class="mb-5 flex items-center justify-between">
						<div class="flex items-center gap-2.5">
							<User class="h-5 w-5 text-brand-blue" />
							<h2 class="font-heading text-base font-bold tracking-wider text-on-surface uppercase">
								Información Personal
							</h2>
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
								form="edit-customer-form"
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

					<form
						id="edit-customer-form"
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
				</div>
			{:else}
				<!-- READ MODE - Personal Info Card -->
				<div class="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
					<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex items-center gap-2.5">
							<User class="h-5 w-5 text-brand-blue" />
							<h2 class="font-heading text-base font-bold tracking-wider text-on-surface uppercase">
								Información Personal
							</h2>
						</div>
						{#if canAct}
							<button
								type="button"
								onclick={startEditing}
								class="inline-flex items-center gap-1.5 self-start rounded-lg border border-outline-variant/40 px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:border-brand-blue hover:text-brand-blue sm:self-auto"
							>
								<SquarePen class="h-4 w-4" />
								Editar Perfil
							</button>
						{/if}
					</div>

					<div class="grid grid-cols-1 gap-y-5 sm:grid-cols-2">
						<div>
							<span
								class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
								>Nombre</span
							>
							<p class="mt-0.5 text-sm font-medium text-on-surface">
								{customer.firstName ?? '-'}
							</p>
						</div>
						<div>
							<span
								class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
								>Apellido</span
							>
							<p class="mt-0.5 text-sm font-medium text-on-surface">
								{customer.lastName ?? '-'}
							</p>
						</div>
						<div>
							<span
								class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
								>Cédula</span
							>
							<p class="mt-0.5 font-mono text-sm text-on-surface">
								{customer.idNumber ?? '-'}
							</p>
						</div>
						<div>
							<span
								class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
								>Fecha de Nacimiento</span
							>
							<p class="mt-0.5 text-sm text-on-surface">
								{customer.birthDate ? formatDate(customer.birthDate) : '-'}
							</p>
						</div>
						<div>
							<span
								class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
								>Teléfono</span
							>
							<p class="mt-0.5 text-sm text-on-surface">
								{customer.primaryPhone ?? '-'}
							</p>
						</div>
						<div>
							<span
								class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
								>Correo</span
							>
							<p class="mt-0.5 text-sm text-on-surface">
								{customer.email ?? '-'}
							</p>
						</div>
						<div class="sm:col-span-2">
							<span
								class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
								>Dirección</span
							>
							<p class="mt-0.5 text-sm text-on-surface">
								{customer.address ?? '-'}
							</p>
						</div>
						{#if customer.notes}
							<div class="sm:col-span-2">
								<span
									class="text-[11px] font-semibold tracking-wider text-on-surface-variant/70 uppercase"
									>Notas</span
								>
								<p class="mt-0.5 text-sm text-on-surface-variant">{customer.notes}</p>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- RIGHT COLUMN: Fórmula Activa -->
		<div class="lg:col-span-2">
			{#if currentPrescription}
				<div class="rounded-xl bg-brand-navy p-6">
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center gap-2.5">
							<Star class="h-5 w-5 text-brand-gold" />
							<h2 class="text-[11px] font-bold tracking-widest text-brand-gold uppercase">
								Fórmula Activa
							</h2>
						</div>
						<span class="text-xs text-white/60"
							>{formatDate(currentPrescription.prescriptionDate)}</span
						>
					</div>

					{#if currentPrescription.recommendedLensType || currentPrescription.doctorName}
						<div class="mb-4 grid gap-3 border-b border-white/10 pb-4 sm:grid-cols-2">
							{#if currentPrescription.recommendedLensType}
								<div
									class="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
								>
									<span class="text-[11px] font-bold tracking-[0.18em] text-white/55 uppercase">
										Tipo de Lente
									</span>
									<LensTypeBadge type={currentPrescription.recommendedLensType} class="shrink-0" />
								</div>
							{/if}
							{#if currentPrescription.doctorName}
								<div
									class="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
								>
									<span class="text-[11px] font-bold tracking-[0.18em] text-white/55 uppercase">
										Doctor
									</span>
									<span class="truncate text-right text-sm font-medium text-white">
										{currentPrescription.doctorName}
									</span>
								</div>
							{/if}
						</div>
					{/if}

					<!-- OD -->
					<div class="mb-3 rounded-xl bg-white/10 p-4">
						<div class="mb-2 flex items-center gap-2">
							<div
								class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold text-[9px] font-bold text-brand-navy"
							>
								OD
							</div>
							<span class="text-xs font-bold tracking-wider text-white/80 uppercase"
								>Ojo Derecho</span
							>
						</div>
						<p class="font-mono text-base font-medium text-white">
							{formatOpticalValue(currentPrescription.odSphere)}
							{formatOpticalValue(currentPrescription.odCylinder)}
							{#if currentPrescription.odAxis != null}x{currentPrescription.odAxis}°{/if}
						</p>
						{#if currentPrescription.odAddition != null}
							<p class="mt-0.5 font-mono text-sm text-white/60">
								Add: {formatOpticalValue(currentPrescription.odAddition)}
							</p>
						{/if}
					</div>

					<!-- OS -->
					<div class="mb-4 rounded-xl bg-white/10 p-4">
						<div class="mb-2 flex items-center gap-2">
							<div
								class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-[9px] font-bold text-white"
							>
								OS
							</div>
							<span class="text-xs font-bold tracking-wider text-white/80 uppercase"
								>Ojo Izquierdo</span
							>
						</div>
						<p class="font-mono text-base font-medium text-white">
							{formatOpticalValue(currentPrescription.osSphere)}
							{formatOpticalValue(currentPrescription.osCylinder)}
							{#if currentPrescription.osAxis != null}x{currentPrescription.osAxis}°{/if}
						</p>
						{#if currentPrescription.osAddition != null}
							<p class="mt-0.5 font-mono text-sm text-white/60">
								Add: {formatOpticalValue(currentPrescription.osAddition)}
							</p>
						{/if}
					</div>

					<div class="mt-4 space-y-4 border-t border-white/10 pt-4">
						<div class="grid gap-2 text-sm text-white/70 sm:grid-cols-2">
							<div class="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
								<span>DP/NP</span>
								<span class="font-mono text-white">{formatDpNp(currentPrescription)}</span>
							</div>
							{#if currentPrescription.altura != null}
								<div
									class="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
								>
									<span>Altura</span>
									<span class="font-mono text-white">{currentPrescription.altura}mm</span>
								</div>
							{/if}
						</div>

						{#if currentPrescription.treatments}
							<div class="flex flex-wrap gap-2">
								{#if currentPrescription.treatments.antiReflective}
									<span
										class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90"
										>Antireflejo</span
									>
								{/if}
								{#if currentPrescription.treatments.blueBlock}
									<span
										class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90"
										>Blue Block</span
									>
								{/if}
								{#if currentPrescription.treatments.photochromic}
									<span
										class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90"
										>Fotocromático</span
									>
								{/if}
								{#if currentPrescription.treatments.other}
									<span
										class="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90"
										>{currentPrescription.treatments.other}</span
									>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div
					class="flex flex-col items-center justify-center rounded-xl bg-brand-navy p-8 text-center"
				>
					<Glasses class="mb-3 h-10 w-10 text-white/30" />
					<p class="text-sm font-medium text-white/60">Sin fórmula activa</p>
					{#if canAct}
						<button
							onclick={() => goto(resolve(`/customers/${customer.id}/prescriptions/new`))}
							class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-bold text-brand-navy shadow-sm hover:bg-brand-gold-dark hover:shadow-md"
						>
							<Plus class="h-3.5 w-3.5" />
							Agregar Fórmula
						</button>
					{/if}
				</div>
			{/if}

			<!-- Actividad Reciente -->
			<div class="mt-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5">
				<div class="mb-4 flex items-center gap-2.5">
					<ShoppingBag class="h-5 w-5 text-brand-blue" />
					<h2 class="font-heading text-base font-bold tracking-wider text-on-surface uppercase">
						Actividad Reciente
					</h2>
				</div>

				{#if recentSales.length > 0}
					<div class="space-y-3">
						{#each recentSales as sale (sale.id)}
							<!-- eslint-disable-next-line svelte/valid-compile -->
							<a
								href={resolve(`/sales/${sale.id}` as '/')}
								class="flex items-center justify-between rounded-lg border border-outline-variant/20 p-3 transition-colors hover:bg-surface-container-low"
							>
								<div>
									<p class="text-sm font-medium text-on-surface">
										Venta #{sale.orderNumber}
									</p>
									<p class="text-xs text-on-surface-variant">
										{formatDate(sale.saleDate, { month: 'short' })}
									</p>
								</div>
								<div class="flex items-center gap-2">
									<span class="font-mono text-sm font-medium text-on-surface">
										${formatCurrency(sale.total)}
									</span>
									<SaleStatusBadge status={sale.status} />
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center py-6 text-center">
						<ShoppingBag class="mb-2 h-8 w-8 text-outline/40" />
						<p class="text-sm text-on-surface-variant">Sin ventas registradas</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Prescriptions History Section -->
	<div class="mt-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h2 class="font-heading text-lg font-semibold text-on-surface">Historial de Fórmulas</h2>
				<p class="text-sm text-on-surface-variant">
					{prescriptions.length} fórmula{prescriptions.length !== 1 ? 's' : ''} registrada{prescriptions.length !==
					1
						? 's'
						: ''}
				</p>
			</div>
			{#if canAct}
				<button
					onclick={() => goto(resolve(`/customers/${customer.id}/prescriptions/new`))}
					class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md"
				>
					<Plus class="h-4 w-4" />
					Nueva Fórmula
				</button>
			{/if}
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
										<span class="text-sm text-outline">-</span>
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
										<AppBadge variant="success" class="gap-1.5 leading-none">
											<Star class="mt-px h-3 w-3 shrink-0" />
											Actual
										</AppBadge>
									{:else}
										<span class="text-sm text-outline">-</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-1">
										{#if canAct}
											<button
												onclick={(e) => {
													e.stopPropagation();
													goto(
														resolve(
															`/customers/${customer.id}/prescriptions/${prescription.id}/edit`
														)
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
										{/if}
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
											onintroend={scrollPrescriptionIntoView}
											class="scroll-mt-24 bg-surface-container-low px-6 py-5"
										>
											<div class="grid gap-5 lg:grid-cols-2">
												<!-- OD Detail -->
												<div class="rounded-xl bg-surface-container-lowest p-5">
													<div class="mb-3 flex items-center gap-2.5">
														<div
															class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-[10px] font-bold text-white"
														>
															OD
														</div>
														<span class="text-sm font-bold tracking-wider text-on-surface uppercase"
															>Ojo Derecho (OD)</span
														>
													</div>
													<div class="grid grid-cols-4 gap-3 text-xs">
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Esfera</span
															>
															<p class="mt-0.5 font-mono text-base text-on-surface">
																{formatOpticalValue(prescription.odSphere)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Cilindro</span
															>
															<p class="mt-0.5 font-mono text-base text-on-surface">
																{formatOpticalValue(prescription.odCylinder)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Eje</span
															>
															<p class="mt-0.5 font-mono text-base text-on-surface">
																{formatAxis(prescription.odAxis)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Adición</span
															>
															<p class="mt-0.5 font-mono text-base text-on-surface">
																{formatOpticalValue(prescription.odAddition)}
															</p>
														</div>
													</div>
												</div>

												<!-- OS Detail -->
												<div class="rounded-xl bg-surface-container-lowest p-5">
													<div class="mb-3 flex items-center gap-2.5">
														<div
															class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-[10px] font-bold text-white"
														>
															OS
														</div>
														<span class="text-sm font-bold tracking-wider text-on-surface uppercase"
															>Ojo Izquierdo (OS)</span
														>
													</div>
													<div class="grid grid-cols-4 gap-3 text-xs">
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Esfera</span
															>
															<p class="mt-0.5 font-mono text-base text-on-surface">
																{formatOpticalValue(prescription.osSphere)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Cilindro</span
															>
															<p class="mt-0.5 font-mono text-base text-on-surface">
																{formatOpticalValue(prescription.osCylinder)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Eje</span
															>
															<p class="mt-0.5 font-mono text-base text-on-surface">
																{formatAxis(prescription.osAxis)}
															</p>
														</div>
														<div>
															<span
																class="font-semibold tracking-wider text-on-surface-variant uppercase"
																>Adición</span
															>
															<p class="mt-0.5 font-mono text-base text-on-surface">
																{formatOpticalValue(prescription.osAddition)}
															</p>
														</div>
													</div>
												</div>
											</div>

											<!-- Distances, Doctor, Treatments, Notes -->
											<div
												class="mt-4 flex flex-wrap items-center gap-5 text-sm text-on-surface-variant"
											>
												<span><strong>DP/NP:</strong> {formatDpNp(prescription)}</span>
												{#if prescription.altura != null}
													<span><strong>Altura:</strong> {prescription.altura}mm</span>
												{/if}
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
														<p class="text-xs text-on-surface-variant">
															{prescription.notes}
														</p>
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
