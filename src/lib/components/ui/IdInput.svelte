<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Label } from '$lib/components/ui/label';
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

	$effect(() => {
		if (value !== previousValue) {
			previousValue = value;
			if (value) {
				const match = value.match(ID_NUMBER_RE);
				if (match) {
					idType = match[1] as IdDocPrefix;
					idNumber = match[2];
				}
			} else {
				idType = 'V';
				idNumber = '';
			}
		}
	});

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

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		idNumber = input.value.replace(/\D/g, '').slice(0, 10);
		updateValue();
	}

	function handleTypeChange() {
		updateValue();
	}

	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);
</script>

<div data-form-field={name} data-field-error={hasError ? 'true' : undefined}>
	{#if label}
		<Label class={['mb-2 block', hasError ? 'text-red-500' : ''].join(' ')}>
			{label}
			{#if required}<span class="text-red-500">*</span>{/if}
		</Label>
	{/if}

	<div class="flex gap-1">
		<select
			bind:value={idType}
			{disabled}
			onchange={handleTypeChange}
			class={[
				'w-14 shrink-0 rounded-lg border bg-white px-2 py-2.5 text-sm shadow-sm transition-colors',
				'focus:border-brand-blue focus:ring-2 focus:ring-brand-blue focus:outline-none',
				'disabled:cursor-not-allowed disabled:opacity-50',
				'border-slate-300'
			].join(' ')}
		>
			{#each ID_DOC_PREFIXES as type (type)}
				<option value={type}>{type}</option>
			{/each}
		</select>

		<input
			type="text"
			inputmode="numeric"
			placeholder="12345678"
			value={idNumber}
			oninput={handleInput}
			{onkeydown}
			aria-invalid={hasError || undefined}
			{disabled}
			maxlength={10}
			class={[
				'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm transition-colors',
				'placeholder:text-slate-400',
				'focus:border-brand-blue focus:ring-2 focus:ring-brand-blue focus:outline-none',
				'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50',
				hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-300'
			].join(' ')}
		/>
	</div>

	<input type="hidden" {name} bind:value />

	{#if displayError}
		<p class="mt-1 text-sm text-red-500">{displayError}</p>
	{/if}
</div>
