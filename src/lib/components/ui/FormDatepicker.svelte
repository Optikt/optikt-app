<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Datepicker, Label, Helper } from 'flowbite-svelte';
	import { getFormErrorMessage, dateToISODateString } from '$lib/utils';

	interface Props {
		value: Date | undefined;
		name?: string;
		label?: string;
		placeholder?: string;
		error?: RemoteFormIssue[] | string | null;
		required?: boolean;
		disabled?: boolean;
		availableFrom?: Date;
		availableTo?: Date;
	}

	let {
		value = $bindable(),
		name,
		label,
		placeholder = 'DD/MM/AAAA',
		error = null,
		required = false,
		disabled = false,
		availableFrom,
		availableTo
	}: Props = $props();

	// For form submission - ISO format using local date components
	// Uses the utility function for consistent date-only handling
	const isoValue = $derived(dateToISODateString(value));

	// Error display
	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);

	// Use es-VE locale for DD/MM/YYYY format
	const locale = 'es-VE';
</script>

<div data-form-field={name} data-field-error={hasError ? 'true' : undefined}>
	{#if label}
		<Label color={hasError ? 'red' : undefined} class="mb-2">
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
		</Label>
	{/if}

	<Datepicker
		bind:value
		{disabled}
		{placeholder}
		{locale}
		{availableFrom}
		{availableTo}
		color={hasError ? 'red' : 'primary'}
		{required}
		inputClass="p-2.5"
	/>

	<!-- Hidden input for form submission -->
	{#if name}
		<input type="hidden" {name} value={isoValue} />
	{/if}

	{#if displayError}
		<Helper color="red" class="mt-1">{displayError}</Helper>
	{/if}
</div>
