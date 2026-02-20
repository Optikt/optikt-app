<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Input, Helper, Label, type InputProps } from 'flowbite-svelte';
	import { getFormErrorMessage } from '$lib/utils';
	import type { ClassValue } from 'svelte/elements';

	interface Props extends InputProps {
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
		size?: 'sm' | 'md' | 'lg';
		title?: string;
		class?: ClassValue;
		divClass?: ClassValue;

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
		divClass,
		class: className,
		required = false,
		title,
		step,
		min,
		max,
		hidden
	}: Props = $props();

	// Use name as fallback for id (for the label's "for" attribute)
	const inputId = $derived(id ?? name);

	// Use unified error handling
	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);
</script>

<!-- Wrapper div ensures this is a single item when used -->
<div class={divClass}>
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
		{required}
		{title}
		{step}
		{min}
		{max}
		{hidden}
	/>
	{#if displayError}
		<Helper color="red">{displayError}</Helper>
	{/if}
</div>
