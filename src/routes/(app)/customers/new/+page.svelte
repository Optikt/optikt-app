<script lang="ts">
	import { ChevronDown, Eye, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { FormInput, FormTextarea, FormDatepicker, IdInput, PageHeader } from '$lib/components/ui';
	import PrescriptionFormFields from '$lib/components/prescriptions/PrescriptionFormFields.svelte';
	import {
		createPrescriptionFormData,
		type PrescriptionFieldIssues
	} from '$lib/components/prescriptions/prescription-form';
	import { createCustomerWithPrescription } from '$lib/remote/customers.remote';
	import {
		scrollToFirstError,
		getErrorMessage,
		toastUnboundErrors,
		generateUUID
	} from '$lib/utils';
	import { nowUTC } from '$lib/dates';
	import type { CreateEntityResult } from '$lib/types';
	import type { Customer } from '$lib/server/db/schema';
	import CustomerReactivateModal from '$lib/components/customers/CustomerReactivateModal.svelte';

	let formInstanceId = $state(generateUUID());
	const currentForm = $derived(createCustomerWithPrescription.for(formInstanceId));

	let isSubmitting = $state(false);
	let showPrescription = $state(false);

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

	let rxData = $state(createPrescriptionFormData());

	const today = nowUTC();

	let showReactivateModal = $state(false);
	let reactivationCandidate = $state<Customer | null>(null);

	const rxFields = $derived(currentForm.fields.prescription as PrescriptionFieldIssues | undefined);

	function resetFormInstance() {
		untrack(() => {
			formInstanceId = generateUUID();
		});
	}

	function handleReactivationSuccess() {
		showReactivateModal = false;
		reactivationCandidate = null;
		goto(resolve('/customers'));
	}

	function handleUnhandledSubmissionRejection() {
		if (!isSubmitting) {
			return;
		}

		isSubmitting = false;
		resetFormInstance();
	}
</script>

<svelte:head>
	<title>Nuevo Cliente - Optikt</title>
</svelte:head>

<svelte:window onunhandledrejection={handleUnhandledSubmissionRejection} />

<div class="p-6">
	<PageHeader
		title="Nuevo Cliente"
		subtitle="Completa los datos del cliente y opcionalmente agrega su primera fórmula óptica"
		backLabel="Volver a clientes"
		backHref="/customers"
	/>

	<form
		{...currentForm.enhance(async ({ submit }) => {
			isSubmitting = true;
			try {
				await submit();

				const allIssues = currentForm.fields.allIssues?.() ?? [];
				if (allIssues.length > 0) {
					scrollToFirstError();
					toastUnboundErrors(allIssues);
					return;
				}

				const result = currentForm.result as CreateEntityResult<Customer> | undefined;

				if (result && !result.success && result.reactivationCandidate) {
					reactivationCandidate = result.reactivationCandidate;
					showReactivateModal = true;
					return;
				}

				if (result && !result.success) {
					toast.error(result.message ?? 'Error creando cliente');
					return;
				}

				const customerId = result?.entity?.id;
				if (!customerId) {
					toast.error('Error inesperado al crear cliente');
					return;
				}

				toast.success(
					showPrescription
						? 'Cliente y fórmula creados exitosamente'
						: 'Cliente creado exitosamente'
				);
				goto(resolve(`/customers/${customerId}`));
			} catch (e) {
				resetFormInstance();
				toast.error(getErrorMessage(e, 'Error creando cliente'));
			} finally {
				isSubmitting = false;
			}
		})}
		class="space-y-6"
	>
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
						error={currentForm.fields.firstName?.issues()}
					/>
					<FormInput
						name="lastName"
						label="Apellido"
						required
						bind:value={customerData.lastName}
						error={currentForm.fields.lastName?.issues()}
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<IdInput
						name="idNumber"
						label="Cédula"
						bind:value={customerData.idNumber}
						error={currentForm.fields.idNumber?.issues()}
					/>
					<FormDatepicker
						name="birthDate"
						label="Fecha de Nacimiento"
						required
						bind:value={customerData.birthDate}
						availableTo={today}
						error={currentForm.fields.birthDate?.issues()}
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
						error={currentForm.fields.primaryPhone?.issues()}
					/>
					<FormInput
						name="email"
						label="Email"
						type="email"
						placeholder="cliente@email.com"
						bind:value={customerData.email}
						error={currentForm.fields.email?.issues()}
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

		<div class="rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
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
					onclick={() => {
						showPrescription = !showPrescription;
					}}
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

			{#if showPrescription}
				<div
					transition:slide={{ duration: 200 }}
					class="border-t border-outline-variant/30 p-6 pt-5"
				>
					<PrescriptionFormFields
						bind:data={rxData}
						issues={rxFields}
						availableTo={today}
						namePrefix="prescription"
					/>
				</div>
			{/if}
		</div>

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

<CustomerReactivateModal
	bind:open={showReactivateModal}
	candidate={reactivationCandidate}
	onSuccess={handleReactivationSuccess}
/>
