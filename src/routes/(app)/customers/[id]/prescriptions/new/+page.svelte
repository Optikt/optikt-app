<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { CustomerPrescriptionEditor } from '$lib/components/prescriptions';
	import {
		createPrescriptionFormData,
		type PrescriptionFieldIssues
	} from '$lib/components/prescriptions/prescription-form';
	import { createPrescriptionForm } from '$lib/remote/prescriptions.remote';
	import type { Customer, Prescription } from '$lib/server/db/schema';
	import { getErrorMessage, scrollToFirstError, toastUnboundErrors } from '$lib/utils';

	let { data } = $props();
	const customer = untrack(() => data.customer) as Customer;

	let isSubmitting = $state(false);
	let formData = $state(createPrescriptionFormData());

	const currentForm = $derived(createPrescriptionForm.for(customer.id));
	const issues = $derived(currentForm.fields as PrescriptionFieldIssues | undefined);
	const hiddenFields = [{ name: 'customerId', value: customer.id }];
	const formProps = $derived(
		currentForm.enhance(async ({ submit }) => {
			isSubmitting = true;
			try {
				await submit();

				const allIssues = currentForm.fields.allIssues?.() ?? [];
				if (allIssues.length > 0) {
					scrollToFirstError();
					toastUnboundErrors(allIssues);
					return;
				}

				const result = currentForm.result as Prescription | undefined;
				if (!result) {
					toast.error('Error inesperado creando la fórmula');
					return;
				}

				toast.success('Fórmula creada exitosamente');
				goBack();
			} catch (error) {
				console.error(error);
				toast.error(getErrorMessage(error, 'Error creando fórmula'));
			} finally {
				isSubmitting = false;
			}
		})
	);

	function goBack() {
		goto(resolve(`/customers/${customer.id}`));
	}
</script>

<svelte:head>
	<title>Nueva Fórmula - {customer.firstName} {customer.lastName} - Optikt</title>
</svelte:head>

<CustomerPrescriptionEditor
	mode="create"
	{customer}
	bind:data={formData}
	{issues}
	{formProps}
	{hiddenFields}
	{isSubmitting}
	onBack={goBack}
	onCancel={goBack}
/>
