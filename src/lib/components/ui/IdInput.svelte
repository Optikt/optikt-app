<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Select, Input, Helper, Label } from 'flowbite-svelte';
	import { getFormErrorMessage, ID_DOC_PREFIXES, ID_NUMBER_RE, type IdDocPrefix } from '$lib/utils';

	interface Props {
		value: string;
		label?: string;
		name?: string;
		error?: RemoteFormIssue[] | string | null;
		disabled?: boolean;
		required?: boolean;
		onchange?: (val: string) => void;
		onkeydown?: (e: KeyboardEvent) => void;
	}

	let {
		value = $bindable(),
		label,
		name,
		error = null,
		disabled = false,
		required = false,
		onchange,
		onkeydown
	}: Props = $props();

	let idType = $state<IdDocPrefix>('V');
	let idNumber = $state('');
	let previousValue = $state('');

	// Parse value whenever it changes from outside
	$effect(() => {
		// Only parse if value changed from external source (not from our own updateValue)
		if (value !== previousValue) {
			previousValue = value;
			if (value) {
				const match = value.match(ID_NUMBER_RE);
				if (match) {
					idType = match[1] as IdDocPrefix;
					idNumber = match[2];
				}
			} else {
				// Reset when value is cleared
				idType = 'V';
				idNumber = '';
			}
		}
	});

	// Combine type and number into full ID
	function updateValue() {
		if (idNumber.length > 0) {
			value = `${idType}-${idNumber}`;
			previousValue = value;
		} else {
			value = '';
			previousValue = '';
		}
		onchange?.(value);
	}

	// Handle number input - only allow digits, max 10
	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		idNumber = input.value.replace(/\D/g, '').slice(0, 10);
		updateValue();
	}

	// Handle type change
	function handleTypeChange() {
		updateValue();
	}

	// Use unified error handling
	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);
</script>

<div data-form-field={name} data-field-error={hasError ? 'true' : undefined}>
	{#if label}
		<Label color={hasError ? 'red' : undefined} class="mb-2">
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
		</Label>
	{/if}

	<div class="flex gap-1">
		<Select bind:value={idType} {disabled} class="w-14 shrink-0" onchange={handleTypeChange}>
			{#each ID_DOC_PREFIXES as type (type)}
				<option value={type}>{type}</option>
			{/each}
		</Select>

		<Input
			type="text"
			inputmode="numeric"
			placeholder="12345678"
			value={idNumber}
			oninput={handleInput}
			{onkeydown}
			aria-invalid={hasError}
			{disabled}
			maxlength={10}
			color={hasError ? 'red' : undefined}
			class="placeholder:text-slate-400"
		/>
	</div>

	<!-- Hidden input with full ID value for form submission -->
	<input type="hidden" {name} bind:value />

	{#if displayError}
		<Helper color="red" class="mt-1">{displayError}</Helper>
	{/if}
</div>
