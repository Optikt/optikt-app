<script lang="ts">
	import { Input, Helper } from 'flowbite-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		value: string;
		error?: string | null;
		label?: Snippet;
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
</script>

{#if label}
	{@render label()}
{/if}
<Input
	{id}
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
