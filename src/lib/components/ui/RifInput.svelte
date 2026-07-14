<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Label } from '$lib/components/ui/label';
	import { getFormErrorMessage, ID_DOC_PREFIXES, RIF_RE, type IdDocPrefix } from '$lib/utils';

	interface Props {
		value: string;
		label?: string;
		name?: string;
		error?: RemoteFormIssue[] | string | null;
		disabled?: boolean;
	}

	let { value = $bindable(), label, name, error = null, disabled = false }: Props = $props();

	let rifType = $state<IdDocPrefix>('J');
	let rifNumber = $state('');

	// Parse initial value (e.g., "J-12345678-9")
	$effect(() => {
		if (value && !rifNumber) {
			const match = value.match(RIF_RE);
			if (match) {
				rifType = match[1] as IdDocPrefix;
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

	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);
	const displayNumber = $derived(formatRifNumber(rifNumber));
</script>

<div>
	{#if label}
		<Label class={['mb-2', hasError ? 'text-red-500' : ''].join(' ')}>{label}</Label>
	{/if}

	<div class="flex gap-2">
		<select
			bind:value={rifType}
			{disabled}
			onchange={handleTypeChange}
			class={[
				'w-20 shrink-0 rounded-lg border bg-white px-2 py-2.5 text-sm shadow-sm transition-colors',
				'focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue',
				'disabled:cursor-not-allowed disabled:opacity-50',
				hasError ? 'border-red-500' : 'border-slate-300'
			].join(' ')}
		>
			{#each ID_DOC_PREFIXES as type (type)}
				<option value={type}>{type}</option>
			{/each}
		</select>

		<input
			type="text"
			inputmode="numeric"
			placeholder="12345678-9"
			value={displayNumber}
			oninput={handleInput}
			onblur={handleBlur}
			{disabled}
			maxlength={9}
			aria-invalid={hasError || undefined}
			class={[
				'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm transition-colors',
				'placeholder:text-slate-400',
				'focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue',
				'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
				hasError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'
			].join(' ')}
		/>
	</div>

	<!-- Hidden input with full RIF value for form submission -->
	<input type="hidden" {name} bind:value />

	{#if error}
		<p class="mt-1 text-sm text-red-500">{error}</p>
	{/if}
</div>
