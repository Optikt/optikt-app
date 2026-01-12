<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Select, Input, Helper, Label } from 'flowbite-svelte';
	import { getFormErrorMessage } from '$lib/utils';

	interface Props {
		value: string;
		label?: string;
		name?: string;
		error?: RemoteFormIssue[] | string | null;
		disabled?: boolean;
		required?: boolean;
	}

	let {
		value = $bindable(),
		label,
		name,
		error = null,
		disabled = false,
		required = false
	}: Props = $props();

	// ID Types: V (Venezuelan), E (Extranjero/Foreign)
	const ID_TYPES = ['V', 'E'] as const;
	type IdType = (typeof ID_TYPES)[number];

	let idType = $state<IdType>('V');
	let idNumber = $state('');
	let previousValue = $state('');

	// Parse value whenever it changes from outside
	$effect(() => {
		// Only parse if value changed from external source (not from our own updateValue)
		if (value !== previousValue) {
			previousValue = value;
			if (value) {
				const match = value.match(/^([VE])-(\d+)$/);
				if (match) {
					idType = match[1] as IdType;
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

<div>
	{#if label}
		<Label color={hasError ? 'red' : undefined} class="mb-2">
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
		</Label>
	{/if}

	<div class="flex gap-2">
		<Select bind:value={idType} {disabled} class="w-20 shrink-0" onchange={handleTypeChange}>
			{#each ID_TYPES as type (type)}
				<option value={type}>{type}</option>
			{/each}
		</Select>

		<Input
			type="text"
			inputmode="numeric"
			placeholder="12345678"
			value={idNumber}
			oninput={handleInput}
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
