<script lang="ts">
	import { Modal, Button, Spinner } from 'flowbite-svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { createCustomerWithPrescription, updateCustomerForm } from '$lib/remote/customers.remote';
	import type { CreateEntityResult } from '$lib/types';
	import { FormInput, FormTextarea, FormDatepicker, IdInput } from '$lib/components/ui';
	import { scrollToFirstError, toastUnboundErrors, getErrorMessage, dateFromUTC } from '$lib/utils';
	import { generateUUID } from '$lib/utils/generateUUID';
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
	const today = new Date();

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
						// Convert UTC midnight (from DB) to local midnight (for Datepicker)
						birthDate: dateFromUTC(customer.birthDate),
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

<Modal bind:open size="lg" {title} outsideclose onclose={onClose}>
	{#if isEditMode && customer}
		<!-- UPDATE FORM -->
		<form
			{...currentUpdateForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleUpdateResult(formEl);
				} catch (e) {
					console.error(e);
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
				<Button color="light" onclick={onClose}>Cancelar</Button>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					{#if isSubmitting}<Spinner size="4" class="mr-2" />{/if}
					{submitText}
				</Button>
			</div>
		</form>
	{:else}
		<!-- CREATE FORM -->
		<form
			{...currentCreateForm.enhance(async ({ form: formEl, submit }) => {
				isSubmitting = true;
				try {
					await submit();
					handleCreateResult(formEl);
				} catch (e) {
					console.error(e);
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
				<Button color="light" onclick={onClose}>Cancelar</Button>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					{#if isSubmitting}<Spinner size="4" class="mr-2" />{/if}
					{submitText}
				</Button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Reactivate Confirmation Modal -->
<CustomerReactivateModal
	bind:open={showReactivateModal}
	candidate={reactivationCandidate}
	onSuccess={handleReactivationSuccess}
/>
