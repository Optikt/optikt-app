<script lang="ts">
	import { Select, Input, Helper, Label } from 'flowbite-svelte';

	interface Props {
		value: string;
		label?: string;
		name?: string;
		error?: string | null;
		disabled?: boolean;
		placeholder?: string;
	}

	let {
		value = $bindable(),
		label,
		name,
		error = null,
		disabled = false,
		placeholder = '412-1234567'
	}: Props = $props();

	// Common country codes for Latin America
	const COUNTRY_CODES = [
		{ code: '+58', name: 'VE', label: '🇻🇪 +58' },
		{ code: '+57', name: 'CO', label: '🇨🇴 +57' },
		{ code: '+56', name: 'CL', label: '🇨🇱 +56' },
		{ code: '+54', name: 'AR', label: '🇦🇷 +54' },
		{ code: '+52', name: 'MX', label: '🇲🇽 +52' },
		{ code: '+1', name: 'US', label: '🇺🇸 +1' },
		{ code: '+34', name: 'ES', label: '🇪🇸 +34' }
	] as const;

	let countryCode = $state('+58');
	let phoneNumber = $state('');

	// Parse initial value (e.g., "+58412-1234567")
	$effect(() => {
		if (value && !phoneNumber) {
			// Try to match country code at start
			for (const country of COUNTRY_CODES) {
				if (value.startsWith(country.code)) {
					countryCode = country.code;
					phoneNumber = value.slice(country.code.length);
					return;
				}
			}
			// If no match, assume it's just a number
			phoneNumber = value;
		}
	});

	// Strip leading zeros from phone number
	function stripLeadingZeros(num: string): string {
		return num.replace(/^0+/, '');
	}

	// Combine country code and number
	function updateValue() {
		const cleaned = stripLeadingZeros(phoneNumber.replace(/[^\d-]/g, ''));
		if (cleaned) {
			value = `${countryCode}${cleaned}`;
		} else {
			value = '';
		}
	}

	// Handle number input
	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		// Allow digits and dashes only
		phoneNumber = input.value.replace(/[^\d-]/g, '');
		updateValue();
	}

	// Handle blur - strip leading zeros
	function handleBlur() {
		phoneNumber = stripLeadingZeros(phoneNumber);
		updateValue();
	}

	// Handle country code change
	function handleCodeChange() {
		updateValue();
	}

	const hasError = $derived(!!error);
</script>

<div>
	{#if label}
		<Label color={hasError ? 'red' : undefined} class="mb-2">{label}</Label>
	{/if}

	<div class="flex gap-2">
		<Select
			name="{name}-code"
			bind:value={countryCode}
			{disabled}
			class="w-28 shrink-0"
			onchange={handleCodeChange}
		>
			{#each COUNTRY_CODES as country (country.code)}
				<option value={country.code}>{country.label}</option>
			{/each}
		</Select>

		<Input
			name="{name}-number"
			type="tel"
			{placeholder}
			bind:value={phoneNumber}
			oninput={handleInput}
			onblur={handleBlur}
			{disabled}
			color={hasError ? 'red' : undefined}
			class="placeholder:text-slate-400"
		/>
	</div>

	<!-- Hidden input with full phone value for form submission -->
	<input type="hidden" {name} bind:value />

	{#if error}
		<Helper color="red" class="mt-1">{error}</Helper>
	{/if}
</div>
