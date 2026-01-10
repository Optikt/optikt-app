<script lang="ts">
	import { Input, Helper, Label } from 'flowbite-svelte';

	interface Props {
		value: string;
		label?: string;
		name?: string;
		id?: string;
		error?: string | null;
		disabled?: boolean;
		placeholder?: string;
	}

	let {
		value = $bindable(),
		label,
		name,
		id,
		error = null,
		disabled = false,
		placeholder = '@usuario'
	}: Props = $props();

	const inputId = $derived(id ?? name);

	// Handle blur - prepend @ if missing
	function handleBlur() {
		if (value && !value.startsWith('@')) {
			value = `@${value}`;
		}
	}

	// Handle input - remove @ if user types it (we'll add it on blur)
	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		// Remove spaces and any @ symbols the user may have typed
		let cleaned = input.value.replace(/\s/g, '');
		// If starts with multiple @, keep just one
		if (cleaned.startsWith('@@')) {
			cleaned = cleaned.replace(/^@+/, '@');
		}
		value = cleaned;
	}

	const hasError = $derived(!!error);
</script>

<div>
	{#if label}
		<Label for={inputId} color={hasError ? 'red' : undefined}>{label}</Label>
	{/if}

	<Input
		id={inputId}
		{name}
		type="text"
		{placeholder}
		bind:value
		oninput={handleInput}
		onblur={handleBlur}
		{disabled}
		color={hasError ? 'red' : undefined}
		class="placeholder:text-slate-400"
	/>

	{#if error}
		<Helper color="red">{error}</Helper>
	{/if}
</div>
