<script lang="ts">
	import { ChevronDown, Eye, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { slide } from 'svelte/transition';
	import { FormInput, FormTextarea, FormDatepicker, IdInput, PageHeader } from '$lib/components/ui';
	import { createCustomerForm } from '$lib/remote/customers.remote';
	import { createPrescriptionCommand } from '$lib/remote/prescriptions.remote';
	import { scrollToFirstError, toastUnboundErrors, getErrorMessage } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { LensType, LENS_TYPE_LABELS } from '$lib/shared/enums/lensTypes';
	import type { CreateEntityResult } from '$lib/types';
	import type { Customer } from '$lib/server/db/schema';
	import CustomerReactivateModal from '$lib/components/customers/CustomerReactivateModal.svelte';

	// Form state
	let isSubmitting = $state(false);
	let formInstanceId = $state(generateUUID());

	// Prescription accordion
	let showPrescription = $state(false);

	// Customer form data (bound to inputs; name attributes handle FormData)
	let customerData = $state({
		firstName: '',
		lastName: '',
		idNumber: '',
		birthDate: undefined as Date | undefined,
		primaryPhone: '',
		email: '',
		address: '',
		notes: ''
	});

	// Prescription form data (not part of the customer form — no name attributes)
	let rxData = $state({
		prescriptionDate: new Date().toISOString().slice(0, 10),
		recommendedLensType: '' as string,
		doctorName: '',
		isCurrent: true,
		// OD
		odSphere: '',
		odCylinder: '',
		odAxis: '',
		odAddition: '',
		// OS
		osSphere: '',
		osCylinder: '',
		osAxis: '',
		osAddition: '',
		// Distances
		dp: '',
		npRight: '',
		npLeft: '',
		// Treatments
		treatmentAntiReflective: false,
		treatmentBlueBlock: false,
		treatmentPhotochromic: false,
		treatmentOther: '',
		notes: ''
	});

	const today = new Date();

	// Show addition fields when lens type isn't MONOFOCAL
	const showAddition = $derived(
		rxData.recommendedLensType !== '' && rxData.recommendedLensType !== LensType.MONOFOCAL
	);

	// Form instances
	const currentCustomerForm = $derived(createCustomerForm.for(formInstanceId));

	// Reactivation modal state
	let showReactivateModal = $state(false);
	let reactivationCandidate = $state<Customer | null>(null);

	function hasPrescriptionData(): boolean {
		return !!(rxData.odSphere || rxData.odCylinder || rxData.osSphere || rxData.osCylinder);
	}

	function buildPrescriptionPayload(customerId: string) {
		return {
			customerId,
			prescriptionDate: rxData.prescriptionDate,
			isCurrent: rxData.isCurrent,
			// OD (empty strings are preprocessed to undefined by the schema)
			odSphere: rxData.odSphere || '',
			odCylinder: rxData.odCylinder || '',
			odAxis: rxData.odAxis || '',
			odAddition: rxData.odAddition || '',
			// OS
			osSphere: rxData.osSphere || '',
			osCylinder: rxData.osCylinder || '',
			osAxis: rxData.osAxis || '',
			osAddition: rxData.osAddition || '',
			// Distances
			dp: rxData.dp || '',
			npRight: rxData.npRight || '',
			npLeft: rxData.npLeft || '',
			// Optional fields
			...(rxData.recommendedLensType
				? { recommendedLensType: rxData.recommendedLensType as LensType }
				: {}),
			...(rxData.doctorName ? { doctorName: rxData.doctorName } : {}),
			...(rxData.treatmentAntiReflective ? { treatmentAntiReflective: true } : {}),
			...(rxData.treatmentBlueBlock ? { treatmentBlueBlock: true } : {}),
			...(rxData.treatmentPhotochromic ? { treatmentPhotochromic: true } : {}),
			...(rxData.treatmentOther ? { treatmentOther: rxData.treatmentOther } : {}),
			...(rxData.notes ? { notes: rxData.notes } : {})
		};
	}

	function handleReactivationSuccess() {
		showReactivateModal = false;
		reactivationCandidate = null;
		goto(resolve('/customers'));
	}
</script>

<svelte:head>
	<title>Nuevo Cliente - Optikt</title>
</svelte:head>

<div class="p-6">
	<PageHeader
		title="Nuevo Cliente"
		subtitle="Completa los datos del cliente y opcionalmente agrega su primera fórmula óptica"
		backLabel="Volver a clientes"
		backHref="/customers"
	/>

	<form
		{...currentCustomerForm.enhance(async ({ submit }) => {
			isSubmitting = true;
			try {
				await submit();

				const allIssues = currentCustomerForm.fields.allIssues?.() ?? [];
				if (allIssues.length > 0) {
					scrollToFirstError();
					toastUnboundErrors(allIssues);
					return;
				}

				const result = currentCustomerForm.result as CreateEntityResult<Customer> | undefined;

				if (result && result.success === false && result.reactivationCandidate) {
					reactivationCandidate = result.reactivationCandidate;
					showReactivateModal = true;
					return;
				}

				const customerId = result?.entity?.id;
				if (!customerId) {
					toast.error('Error inesperado al crear cliente');
					return;
				}

				// Step 2: Create prescription if expanded and has data
				if (showPrescription && hasPrescriptionData()) {
					try {
						const rxResult = await createPrescriptionCommand(buildPrescriptionPayload(customerId));
						if (rxResult.success) {
							toast.success('Cliente y fórmula creados exitosamente');
						} else {
							toast.warning(
								'Cliente creado, pero hubo errores en la fórmula. Puedes agregarla después.'
							);
						}
					} catch (rxError) {
						console.error(rxError);
						toast.warning(
							'Cliente creado, pero hubo un error con la fórmula. Puedes agregarla después.'
						);
					}
				} else {
					toast.success('Cliente creado exitosamente');
				}

				goto(resolve(`/customers/${customerId}`));
			} catch (e) {
				console.error(e);
				toast.error(getErrorMessage(e, 'Error creando cliente'));
			} finally {
				isSubmitting = false;
			}
		})}
		class="space-y-6"
	>
		<!-- Section 1: Personal Info -->
		<div class="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
			<div class="mb-5 flex items-center gap-2.5">
				<div class="h-6 w-1.5 rounded-full bg-brand-gold"></div>
				<h2 class="font-heading text-lg font-semibold text-on-surface">Información Personal</h2>
			</div>

			<div class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<FormInput
						name="firstName"
						label="Nombre"
						required
						bind:value={customerData.firstName}
						error={currentCustomerForm.fields.firstName?.issues()}
					/>
					<FormInput
						name="lastName"
						label="Apellido"
						required
						bind:value={customerData.lastName}
						error={currentCustomerForm.fields.lastName?.issues()}
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<IdInput
						name="idNumber"
						label="Cédula"
						bind:value={customerData.idNumber}
						error={currentCustomerForm.fields.idNumber?.issues()}
					/>
					<FormDatepicker
						name="birthDate"
						label="Fecha de Nacimiento"
						required
						bind:value={customerData.birthDate}
						availableTo={today}
						error={currentCustomerForm.fields.birthDate?.issues()}
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<FormInput
						name="primaryPhone"
						label="Teléfono"
						type="tel"
						required
						placeholder="+58 412-1234567"
						bind:value={customerData.primaryPhone}
						error={currentCustomerForm.fields.primaryPhone?.issues()}
					/>
					<FormInput
						name="email"
						label="Email"
						type="email"
						placeholder="cliente@email.com"
						bind:value={customerData.email}
						error={currentCustomerForm.fields.email?.issues()}
					/>
				</div>

				<FormInput
					name="address"
					label="Dirección"
					placeholder="Av. Principal, Centro..."
					bind:value={customerData.address}
				/>

				<FormTextarea
					name="notes"
					label="Notas"
					placeholder="Observaciones sobre el cliente..."
					rows={2}
					bind:value={customerData.notes}
				/>
			</div>
		</div>

		<!-- Section 2: Prescription (Collapsible) -->
		<div class="rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
			<!-- Accordion header -->
			<div class="flex items-center justify-between p-6">
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {showPrescription
							? 'bg-brand-blue text-white'
							: 'bg-surface-container-high text-outline'}"
					>
						<Eye size={20} />
					</div>
					<div>
						<h2 class="font-heading text-xl font-semibold text-on-surface">Fórmula Óptica</h2>
						<p class="text-sm text-on-surface-variant">
							Agrega la primera fórmula del cliente (opcional)
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (showPrescription = !showPrescription)}
					class={showPrescription
						? 'inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-4 py-2 text-xs font-bold tracking-wider text-brand-navy uppercase shadow-sm transition-colors hover:bg-brand-gold-dark hover:shadow-md'
						: 'inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-4 py-2 text-xs font-bold tracking-wider text-on-surface-variant uppercase transition-colors hover:border-brand-blue hover:text-brand-blue'}
				>
					{#if showPrescription}
						<ChevronDown size={14} class="rotate-180" />
						NO AGREGAR FÓRMULA
					{:else}
						<Plus size={14} />
						AGREGAR FÓRMULA
					{/if}
				</button>
			</div>

			<!-- Accordion content -->
			{#if showPrescription}
				<div
					transition:slide={{ duration: 200 }}
					class="border-t border-outline-variant/30 p-6 pt-5"
				>
					<div class="space-y-5">
						<!-- Top row: Date, Lens Type, Doctor, Current toggle -->
						<div class="grid items-end gap-4 sm:grid-cols-3">
							<div>
								<label
									for="rxDate"
									class="mb-1.5 block text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
								>
									Fecha de Fórmula<span class="text-error">*</span>
								</label>
								<input
									id="rxDate"
									type="date"
									bind:value={rxData.prescriptionDate}
									max={today.toISOString().slice(0, 10)}
									class="w-full rounded-lg border-none bg-surface-container-high p-3 text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
								/>
							</div>
							<div>
								<label
									for="lensType"
									class="mb-1.5 block text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
								>
									Tipo de Lente
								</label>
								<select
									id="lensType"
									bind:value={rxData.recommendedLensType}
									class="w-full rounded-lg border-none bg-surface-container-high p-3 text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
								>
									<option value="">— Seleccionar —</option>
									{#each Object.entries(LENS_TYPE_LABELS) as [value, label] (value)}
										<option {value}>{label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label
									for="doctorName"
									class="mb-1.5 block text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
								>
									Doctor
								</label>
								<input
									id="doctorName"
									type="text"
									placeholder="Nombre del profesional"
									bind:value={rxData.doctorName}
									class="w-full rounded-lg border-none bg-surface-container-high p-3 text-base text-on-surface placeholder:text-outline focus:bg-surface-container-highest focus:ring-0"
								/>
							</div>
						</div>

						<!-- Current prescription toggle -->
						<label class="flex items-center gap-2.5">
							<input
								type="checkbox"
								bind:checked={rxData.isCurrent}
								class="h-4 w-4 rounded border-outline-variant text-brand-gold focus:ring-brand-gold"
							/>
							<span class="text-sm font-bold tracking-wider text-on-surface uppercase"
								>Fórmula Actual</span
							>
						</label>

						<!-- OD / OS side by side -->
						<div class="grid gap-5 lg:grid-cols-2">
							<!-- OD -->
							<div class="rounded-xl bg-surface-container-low p-5">
								<div class="mb-4 flex items-center gap-2.5">
									<div
										class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-[10px] font-bold text-white"
									>
										OD
									</div>
									<span class="text-sm font-bold tracking-wider text-on-surface uppercase"
										>Ojo Derecho (OD)</span
									>
								</div>
								<div
									class="grid grid-cols-2 gap-3"
									class:grid-cols-2={!showAddition}
									class:sm:grid-cols-4={showAddition}
									class:sm:grid-cols-3={!showAddition}
								>
									<div>
										<label
											for="od-sphere"
											class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
											>Esfera</label
										>
										<input
											id="od-sphere"
											type="text"
											inputmode="decimal"
											placeholder="-2.00"
											bind:value={rxData.odSphere}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
									<div>
										<label
											for="od-cylinder"
											class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
											>Cilindro</label
										>
										<input
											id="od-cylinder"
											type="text"
											inputmode="decimal"
											placeholder="-0.50"
											bind:value={rxData.odCylinder}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
									<div>
										<label
											for="od-axis"
											class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
											>Eje</label
										>
										<input
											id="od-axis"
											type="text"
											inputmode="numeric"
											placeholder="180"
											bind:value={rxData.odAxis}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
									{#if showAddition}
										<div>
											<label
												for="od-addition"
												class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
												>Adición</label
											>
											<input
												id="od-addition"
												type="text"
												inputmode="decimal"
												placeholder="+1.50"
												bind:value={rxData.odAddition}
												class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
											/>
										</div>
									{/if}
								</div>
							</div>

							<!-- OS -->
							<div class="rounded-xl bg-surface-container-low p-5">
								<div class="mb-4 flex items-center gap-2.5">
									<div
										class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-[10px] font-bold text-white"
									>
										OS
									</div>
									<span class="text-sm font-bold tracking-wider text-on-surface uppercase"
										>Ojo Izquierdo (OS)</span
									>
								</div>
								<div
									class="grid grid-cols-2 gap-3"
									class:grid-cols-2={!showAddition}
									class:sm:grid-cols-4={showAddition}
									class:sm:grid-cols-3={!showAddition}
								>
									<div>
										<label
											for="os-sphere"
											class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
											>Esfera</label
										>
										<input
											id="os-sphere"
											type="text"
											inputmode="decimal"
											placeholder="-1.75"
											bind:value={rxData.osSphere}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
									<div>
										<label
											for="os-cylinder"
											class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
											>Cilindro</label
										>
										<input
											id="os-cylinder"
											type="text"
											inputmode="decimal"
											placeholder="-0.25"
											bind:value={rxData.osCylinder}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
									<div>
										<label
											for="os-axis"
											class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
											>Eje</label
										>
										<input
											id="os-axis"
											type="text"
											inputmode="numeric"
											placeholder="175"
											bind:value={rxData.osAxis}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
									{#if showAddition}
										<div>
											<label
												for="os-addition"
												class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
												>Adición</label
											>
											<input
												id="os-addition"
												type="text"
												inputmode="decimal"
												placeholder="+1.50"
												bind:value={rxData.osAddition}
												class="w-full rounded-lg border-none bg-surface-container-high p-2.5 font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
											/>
										</div>
									{/if}
								</div>
							</div>
						</div>

						<!-- Distances + Treatments side by side -->
						<div class="grid gap-6 lg:grid-cols-2">
							<!-- Distances -->
							<div>
								<h3
									class="mb-3 text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
								>
									Distancias
								</h3>
								<div class="grid grid-cols-3 gap-3">
									<div class="text-center">
										<label
											for="rx-dp"
											class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
											>DP (mm)</label
										>
										<input
											id="rx-dp"
											type="text"
											inputmode="numeric"
											placeholder="62"
											bind:value={rxData.dp}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 text-center font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
									<div class="text-center">
										<label
											for="rx-np-right"
											class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
											>NP Der</label
										>
										<input
											id="rx-np-right"
											type="text"
											inputmode="numeric"
											placeholder="31"
											bind:value={rxData.npRight}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 text-center font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
									<div class="text-center">
										<label
											for="rx-np-left"
											class="mb-1 block text-xs font-semibold tracking-wider text-on-surface-variant uppercase"
											>NP Izq</label
										>
										<input
											id="rx-np-left"
											type="text"
											inputmode="numeric"
											placeholder="31"
											bind:value={rxData.npLeft}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 text-center font-mono text-base text-on-surface focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
								</div>
							</div>

							<!-- Treatments -->
							<div>
								<h3
									class="mb-3 text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
								>
									Tratamientos
								</h3>
								<div class="flex flex-wrap gap-x-5 gap-y-3">
									<label class="flex items-center gap-2">
										<input
											type="checkbox"
											bind:checked={rxData.treatmentAntiReflective}
											class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue"
										/>
										<span class="text-xs font-semibold tracking-wider text-on-surface uppercase"
											>Antireflejo</span
										>
									</label>
									<label class="flex items-center gap-2">
										<input
											type="checkbox"
											bind:checked={rxData.treatmentBlueBlock}
											class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue"
										/>
										<span class="text-xs font-semibold tracking-wider text-on-surface uppercase"
											>Blueblock</span
										>
									</label>
									<label class="flex items-center gap-2">
										<input
											type="checkbox"
											bind:checked={rxData.treatmentPhotochromic}
											class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue"
										/>
										<span class="text-xs font-semibold tracking-wider text-on-surface uppercase"
											>Fotocromático</span
										>
									</label>
									<label class="flex items-center gap-2">
										<input
											type="checkbox"
											class="h-4 w-4 rounded border-outline-variant text-brand-blue focus:ring-brand-blue"
											checked={rxData.treatmentOther !== ''}
											onchange={() => {
												if (rxData.treatmentOther) rxData.treatmentOther = '';
											}}
										/>
										<span class="text-xs font-semibold tracking-wider text-on-surface uppercase"
											>Otros</span
										>
									</label>
								</div>

								{#if rxData.treatmentOther !== undefined}
									<div class="mt-3">
										<input
											type="text"
											placeholder="Otros tratamientos..."
											bind:value={rxData.treatmentOther}
											class="w-full rounded-lg border-none bg-surface-container-high p-2.5 text-base text-on-surface placeholder:text-outline focus:bg-surface-container-highest focus:ring-0"
										/>
									</div>
								{/if}
							</div>
						</div>

						<!-- Prescription notes -->
						<div>
							<label
								for="rx-notes"
								class="mb-1.5 block text-sm font-semibold tracking-wider text-on-surface-variant uppercase"
								>Notas de Fórmula</label
							>
							<textarea
								id="rx-notes"
								placeholder="Observaciones técnicas, requerimientos específicos del paciente o detalles del tallado..."
								rows={3}
								bind:value={rxData.notes}
								class="w-full rounded-lg border-none bg-surface-container-high p-3 text-base text-on-surface placeholder:text-outline focus:bg-surface-container-highest focus:ring-0"
							></textarea>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex justify-end gap-3">
			<button
				type="button"
				onclick={() => goto(resolve('/customers'))}
				class="rounded-lg px-5 py-2.5 font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
			>
				Cancelar
			</button>
			<button
				type="submit"
				disabled={isSubmitting}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md disabled:opacity-60"
			>
				{#if isSubmitting}
					<span
						class="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy/30 border-t-brand-navy"
					></span>
				{/if}
				CREAR CLIENTE
			</button>
		</div>
	</form>
</div>

<!-- Reactivation Modal -->
<CustomerReactivateModal
	bind:open={showReactivateModal}
	candidate={reactivationCandidate}
	onSuccess={handleReactivationSuccess}
/>
