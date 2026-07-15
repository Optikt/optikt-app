<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Label } from '$lib/components/ui/label';
	import { getFormErrorMessage } from '$lib/utils';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		value: string;
		error?: RemoteFormIssue[] | string | null;
		label?: string;
		id?: string;
		name?: string;
		type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
		placeholder?: string;
		disabled?: boolean;
		readonly?: boolean;
		autocomplete?: 'off' | 'on' | 'new-password' | 'current-password' | 'email' | 'username';
		title?: string;
		class?: ClassValue;
		divClass?: ClassValue;
		required?: boolean;
		step?: string | number;
		min?: string | number;
		max?: string | number;
		hidden?: boolean;
	}

	let {
		value = $bindable(),
		error = null,
		label,
		id,
		name,
		type = 'text',
		placeholder,
		disabled = false,
		readonly = false,
		autocomplete,
		divClass,
		class: className,
		required = false,
		title,
		step,
		min,
		max,
		hidden
	}: Props = $props();

	const inputId = $derived(id ?? name);
	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);

	const stepStr = $derived(step !== undefined ? String(step) : undefined);
	const minStr = $derived(min !== undefined ? String(min) : undefined);
	const maxStr = $derived(max !== undefined ? String(max) : undefined);

	const inputClass = $derived(
		[
			'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm transition-colors',
			'placeholder:text-slate-400',
			'focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue',
			'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
			hasError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-slate-300',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<div class={divClass} data-form-field={name} data-field-error={hasError ? 'true' : undefined}>
	{#if label}
		<Label
			for={inputId}
			class={['mb-2 block text-sm font-medium', hasError ? 'text-red-500' : 'text-slate-700'].join(
				' '
			)}
		>
			{label}
		</Label>
	{/if}
	<input
		{id}
		{name}
		{type}
		{placeholder}
		{disabled}
		{readonly}
		{autocomplete}
		{required}
		{title}
		step={stepStr}
		min={minStr}
		max={maxStr}
		{hidden}
		bind:value
		aria-invalid={hasError || undefined}
		class={inputClass}
	/>
	{#if displayError}
		<p class="mt-1 text-sm text-red-500">{displayError}</p>
	{/if}
</div>
