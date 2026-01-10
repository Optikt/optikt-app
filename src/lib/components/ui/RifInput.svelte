<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Select, Input, Helper, Label } from 'flowbite-svelte';
	import { getErrorMessage } from '$lib/utils';

	interface Props {
		value: string;
		label?: string;
		name?: string;
		error?: RemoteFormIssue[] | string | null;
		disabled?: boolean;
	}

	let { value = $bindable(), label, name, error = null, disabled = false }: Props = $props();

	// Split RIF into type and number parts
	const RIF_TYPES = ['V', 'E', 'J', 'G'] as const;
	type RifType = (typeof RIF_TYPES)[number];

	let rifType = $state<RifType>('J');
	let rifNumber = $state('');

	// Parse initial value (e.g., "J-12345678-9")
	$effect(() => {
		if (value && !rifNumber) {
			const match = value.match(/^([VEJG])-?(\d{8})-?(\d)$/);
			if (match) {
				rifType = match[1] as RifType;
				rifNumber = match[2] + match[3]; // Full 9 digits
			}
		}
	});

	// Format RIF number with dash before last digit
	function formatRifNumber(num: string): string {
		const digits = num.replace(/\D/g, '').slice(0, 9);
		if (digits.length === 9) {
			return digits.slice(0, 8) + '-' + digits.slice(8);
		}
		return digits;
	}

	// Combine type and number into full RIF
	function updateValue() {
		const formatted = formatRifNumber(rifNumber);
		if (formatted.length > 0) {
			value = `${rifType}-${formatted}`;
		} else {
			value = '';
		}
	}

	// Handle number input - only allow digits
	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		rifNumber = input.value.replace(/\D/g, '').slice(0, 9);
		updateValue();
	}

	// Handle blur - format the number
	function handleBlur() {
		rifNumber = formatRifNumber(rifNumber);
		updateValue();
	}

	// Handle type change
	function handleTypeChange() {
		updateValue();
	}

	const displayError = $derived(getErrorMessage(error));
	const hasError = $derived(!!displayError);
	const displayNumber = $derived(formatRifNumber(rifNumber));
</script>

<div>
	{#if label}
		<Label color={hasError ? 'red' : undefined} class="mb-2">{label}</Label>
	{/if}

	<div class="flex gap-2">
		<Select
			name="{name}-type"
			bind:value={rifType}
			{disabled}
			class="w-20 shrink-0"
			onchange={handleTypeChange}
		>
			{#each RIF_TYPES as type (type)}
				<option value={type}>{type}</option>
			{/each}
		</Select>

		<Input
			name="{name}-number"
			type="text"
			inputmode="numeric"
			placeholder="12345678-9"
			value={displayNumber}
			oninput={handleInput}
			onblur={handleBlur}
			{disabled}
			color={hasError ? 'red' : undefined}
			class="placeholder:text-slate-400"
		/>
	</div>

	<!-- Hidden input with full RIF value for form submission -->
	<input type="hidden" {name} bind:value />

	{#if error}
		<Helper color="red" class="mt-1">{error}</Helper>
	{/if}
</div>
