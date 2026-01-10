<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Input, Helper, Label } from 'flowbite-svelte';

	interface Props {
		value: string;
		// TODO: Make error and issues one prop, can combine them into a single field prop
		error?: string | null;
		issues?: RemoteFormIssue[]; // From form fields.X.issues()
		label?: string;
		id?: string;
		name?: string;
		type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
		placeholder?: string;
		disabled?: boolean;
		readonly?: boolean;
		autocomplete?: 'off' | 'on' | 'new-password' | 'current-password' | 'email' | 'username';
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}

	let {
		value = $bindable(),
		error = null,
		issues,
		label,
		id,
		name,
		type = 'text',
		placeholder,
		disabled = false,
		readonly = false,
		autocomplete,
		size = 'md',
		class: className
	}: Props = $props();

	// Use name as fallback for id (for the label's "for" attribute)
	const inputId = $derived(id ?? name);

	// Combine error string and issues array
	const displayError = $derived(error || (issues && issues.length > 0 ? issues[0].message : null));
	const hasError = $derived(!!displayError);
</script>

{#if label}
	<Label for={inputId} color={hasError ? 'red' : undefined}>{label}</Label>
{/if}
<Input
	id={inputId}
	{name}
	{type}
	{placeholder}
	{disabled}
	{readonly}
	{autocomplete}
	{size}
	class={['placeholder:text-slate-400', className]}
	bind:value
	color={hasError ? 'red' : undefined}
/>
{#if displayError}
	<Helper color="red">{displayError}</Helper>
{/if}
