<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Textarea, Helper, Label, type TextareaProps } from 'flowbite-svelte';
	import { getFormErrorMessage } from '$lib/utils';

	interface Props extends TextareaProps {
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

	// Use name as fallback for id (for the label's "for" attribute)
	const inputId = $derived(id ?? name);

	// Use unified error handling
	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);
</script>

<!-- Wrapper div ensures this is a single item when used -->
<div>
	{#if label}
		<Label for={inputId} color={hasError ? 'red' : undefined}>{label}</Label>
	{/if}
	<Textarea
		id={inputId}
		{name}
		{placeholder}
		{disabled}
		{readonly}
		{rows}
		class={['w-full placeholder:text-slate-400', className]}
		bind:value
		{required}
	/>
	{#if displayError}
		<Helper color="red">{displayError}</Helper>
	{/if}
</div>
