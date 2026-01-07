<script lang="ts">
	import { Input, Helper, Label } from 'flowbite-svelte';

	interface Props {
		value: string;
		error?: string | null;
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
</script>

{#if label}
	<Label for={inputId} color={error ? 'red' : undefined}>{label}</Label>
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
	class={className}
	bind:value
	color={error ? 'red' : undefined}
/>
{#if error}
	<Helper color="red">{error}</Helper>
{/if}
