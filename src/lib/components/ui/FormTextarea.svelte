<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Textarea, Helper, Label } from 'flowbite-svelte';

	interface Props {
		value: string;
		error?: string | null;
		issues?: RemoteFormIssue[]; // From form fields.X.issues()
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
		issues,
		label,
		id,
		name,
		placeholder,
		disabled = false,
		readonly = false,
		rows = 3,
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
<Textarea
	id={inputId}
	{name}
	{placeholder}
	{disabled}
	{readonly}
	{rows}
	class={['w-full placeholder:text-slate-400', className]}
	bind:value
/>
{#if displayError}
	<Helper color="red">{displayError}</Helper>
{/if}
