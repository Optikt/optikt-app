<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Label } from '$lib/components/ui/label';
	import { getFormErrorMessage } from '$lib/utils';

	interface Props {
		value: string;
		error?: RemoteFormIssue[] | string | null;
		label?: string;
		id?: string;
		name?: string;
		placeholder?: string;
		disabled?: boolean;
		readonly?: boolean;
		rows?: number;
		class?: string;
		required?: boolean;
	}

	let {
		value = $bindable(),
		error = null,
		label,
		id,
		name,
		placeholder,
		disabled = false,
		readonly = false,
		rows = 3,
		class: className,
		required = false
	}: Props = $props();

	const inputId = $derived(id ?? name);
	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);
</script>

<div data-form-field={name} data-field-error={hasError ? 'true' : undefined}>
	{#if label}
		<Label for={inputId} class={hasError ? 'text-red-500' : ''}>{label}</Label>
	{/if}
	<textarea
		{id}
		{name}
		{placeholder}
		{disabled}
		{readonly}
		{rows}
		{required}
		bind:value
		aria-invalid={hasError || undefined}
		class={[
			'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm transition-colors',
			'placeholder:text-slate-400',
			'focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue',
			'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
			hasError
				? 'border-red-500 focus:ring-red-500 focus:border-red-500'
				: 'border-slate-300',
			className
		].filter(Boolean).join(' ')}
	></textarea>
	{#if displayError}
		<p class="mt-1 text-sm text-red-500">{displayError}</p>
	{/if}
</div>
