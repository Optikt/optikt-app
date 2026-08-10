<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createCustomerWithPrescription, updateCustomerForm } from '$lib/remote/customers.remote';
	import type { CreateEntityResult } from '$lib/types';
	import { FormInput, FormTextarea, FormDatepicker, IdInput } from '$lib/components/ui';
	import {
		scrollToFirstError,
		toastUnboundErrors,
		getErrorMessage,
		parseISODateToLocal
	} from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
	import { nowUTC } from '$lib/dates';
	import type { Customer } from '$lib/server/db/schema';
	import CustomerReactivateModal from './CustomerReactivateModal.svelte';

	interface Props {
		open: boolean;
		customer?: Customer | null;
		preserveData?: boolean; // When true, don't reset form data on open
		onSuccess?: (createdCustomerId?: string) => void;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		customer = null,
		preserveData = $bindable(false),
		onSuccess,
		onClose
	}: Props = $props();

	// Form state
	let isSubmitting = $state(false);
	const isEditMode = $derived(!!customer);
	const title = $derived(isEditMode ? 'Editar Cliente' : 'Agregar Cliente');
	const submitText = $derived(isEditMode ? 'Guardar Cambios' : 'Crear Cliente');

	// Form data
	let formData = $state({
		firstName: '',
		lastName: '',
		idNumber: '',
		birthDate: undefined as Date | undefined,
		primaryPhone: '',
		email: '',
		address: '',
		notes: ''
	});

	// Max date for birth date picker (no future dates)
	const today = nowUTC();

	// Reactivation modal state
	let showReactivateModal = $state(false);
	let reactivationCandidate = $state<Customer | null>(null);

	// Reset form when modal opens (unless preserveData is true)
	let formInstanceId = $state(generateUUID());
	$effect(() => {
		if (open) {
			untrack(() => {
				// If preserveData is true, skip the reset and clear the flag
				if (preserveData) {
					preserveData = false;
					return;
				}

				formInstanceId = generateUUID();
				if (customer) {
					formData = {
						firstName: customer.firstName ?? '',
						lastName: customer.lastName ?? '',
						idNumber: customer.idNumber ?? '',
						// Convert ISO date string (from DB) to local midnight Date (for Datepicker)
						birthDate: parseISODateToLocal(customer.birthDate),
						primaryPhone: customer.primaryPhone ?? '',
						email: customer.email ?? '',
						address: customer.address ?? '',
						notes: customer.notes ?? ''
					};
				} else {
					formData = {
						firstName: '',
						lastName: '',
						idNumber: '',
						birthDate: undefined,
						primaryPhone: '',
						email: '',
						address: '',
						notes: ''
					};
				}
			});
		}
	});

	// Form instances
	const currentCreateForm = $derived(createCustomerWithPrescription.for(formInstanceId));
	const currentUpdateForm = $derived(
		updateCustomerForm.for(`${customer?.id ?? 'new'}-${formInstanceId}`)
	);

	// Handle create result
	function handleCreateResult(formEl: HTMLFormElement) {
		const allIssues = currentCreateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			toastUnboundErrors(allIssues);
			return;
		}

		const result = currentCreateForm.result as CreateEntityResult<Customer> | undefined;

		if (result && result.success === false && result.reactivationCandidate) {
			// Reactivation candidate found - show reactivation confirmation modal
			reactivationCandidate = result.reactivationCandidate;
			showReactivateModal = true;
		} else {
			toast.success('Cliente creado exitosamente');
			formEl.reset();
			open = false;
			onSuccess?.(result?.entity?.id);
		}
	}

	// Handle update result
	function handleUpdateResult(formEl: HTMLFormElement) {
		const allIssues = currentUpdateForm.fields.allIssues?.() ?? [];
		if (allIssues.length > 0) {
			scrollToFirstError();
			toastUnboundErrors(allIssues);
			return;
		}

		toast.success('Cliente actualizado exitosamente');
		formEl.reset();
		open = false;
		onSuccess?.();
	}

	// Handle reactivation success
	function handleReactivationSuccess() {
		showReactivateModal = false;
		reactivationCandidate = null;
		open = false;
		onSuccess?.();
	}
</script>

<Dialog.Root
	bind:open
	onOpenChangeComplete={(o) => {
		if (!o) onClose();
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>
		{#if isEditMode && customer}
			<!-- UPDATE FORM -->
			<form
				{...currentUpdateForm.enhance(async ({ element: formEl, submit }) => {
					isSubmitting = true;
					try {
						await submit();
						handleUpdateResult(formEl);
					} catch (e) {
						toast.error(getErrorMessage(e, 'Error actualizando cliente'));
					} finally {
						isSubmitting = false;
					}
				})}
				class="space-y-5"
			>
				<input type="hidden" name="id" value={customer.id} />

				<div class="grid gap-4 sm:grid-cols-2">
					<FormInput
						name="firstName"
						label="Nombre"
						required
						bind:value={formData.firstName}
						error={currentUpdateForm.fields.firstName?.issues()}
					/>
					<FormInput
						name="lastName"
						label="Apellido"
						required
						bind:value={formData.lastName}
						error={currentUpdateForm.fields.lastName?.issues()}
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<IdInput
						name="idNumber"
						label="Cédula"
						bind:value={formData.idNumber}
						error={currentUpdateForm.fields.idNumber?.issues()}
					/>
					<FormDatepicker
						name="birthDate"
						label="Fecha de Nacimiento"
						required
						bind:value={formData.birthDate}
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
						bind:value={formData.primaryPhone}
						error={currentUpdateForm.fields.primaryPhone?.issues()}
					/>
					<FormInput
						name="email"
						label="Email"
						type="email"
						placeholder="cliente@email.com"
						bind:value={formData.email}
						error={currentUpdateForm.fields.email?.issues()}
					/>
				</div>

				<FormInput
					name="address"
					label="Dirección"
					placeholder="Av. Principal, Centro..."
					bind:value={formData.address}
				/>

				<FormTextarea
					name="notes"
					label="Notas"
					placeholder="Observaciones sobre el cliente..."
					rows={2}
					bind:value={formData.notes}
				/>

				<div class="flex justify-end gap-3 border-t pt-4">
					<Button variant="outline" onclick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={isSubmitting}>
						{#if isSubmitting}<svg
								class="mx-auto h-5 w-5 animate-spin"
								viewBox="0 0 24 24"
								fill="none"
								><circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								/><path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
								/></svg
							>{/if}
						{submitText}
					</Button>
				</div>
			</form>
		{:else}
			<!-- CREATE FORM -->
			<form
				{...currentCreateForm.enhance(async ({ element: formEl, submit }) => {
					isSubmitting = true;
					try {
						await submit();
						handleCreateResult(formEl);
					} catch (e) {
						toast.error(getErrorMessage(e, 'Error creando cliente'));
					} finally {
						isSubmitting = false;
					}
				})}
				class="space-y-5"
			>
				<div class="grid gap-4 sm:grid-cols-2">
					<FormInput
						name="firstName"
						label="Nombre"
						required
						bind:value={formData.firstName}
						error={currentCreateForm.fields.firstName?.issues()}
					/>
					<FormInput
						name="lastName"
						label="Apellido"
						required
						bind:value={formData.lastName}
						error={currentCreateForm.fields.lastName?.issues()}
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<IdInput
						name="idNumber"
						label="Cédula"
						bind:value={formData.idNumber}
						error={currentCreateForm.fields.idNumber?.issues()}
					/>
					<FormDatepicker
						name="birthDate"
						label="Fecha de Nacimiento"
						required
						bind:value={formData.birthDate}
						availableTo={today}
						error={currentCreateForm.fields.birthDate?.issues()}
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<FormInput
						name="primaryPhone"
						label="Teléfono"
						type="tel"
						required
						placeholder="+58 412-1234567"
						bind:value={formData.primaryPhone}
						error={currentCreateForm.fields.primaryPhone?.issues()}
					/>
					<FormInput
						name="email"
						label="Email"
						type="email"
						placeholder="cliente@email.com"
						bind:value={formData.email}
						error={currentCreateForm.fields.email?.issues()}
					/>
				</div>

				<FormInput
					name="address"
					label="Dirección"
					placeholder="Av. Principal, Centro..."
					bind:value={formData.address}
				/>

				<FormTextarea
					name="notes"
					label="Notas"
					placeholder="Observaciones sobre el cliente..."
					rows={2}
					bind:value={formData.notes}
				/>

				<div class="flex justify-end gap-3 border-t pt-4">
					<Button variant="outline" onclick={onClose}>Cancelar</Button>
					<Button type="submit" disabled={isSubmitting}>
						{#if isSubmitting}<svg
								class="mx-auto h-5 w-5 animate-spin"
								viewBox="0 0 24 24"
								fill="none"
								><circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								/><path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
								/></svg
							>{/if}
						{submitText}
					</Button>
				</div>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- Reactivate Confirmation Modal -->
<CustomerReactivateModal
	bind:open={showReactivateModal}
	candidate={reactivationCandidate}
	onSuccess={handleReactivationSuccess}
/>
