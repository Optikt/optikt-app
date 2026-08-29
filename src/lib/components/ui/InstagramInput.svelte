<script lang="ts">
	import { Label } from '$lib/components/ui/label';

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
		<Label for={inputId} class={hasError ? 'text-red-500' : ''}>{label}</Label>
	{/if}

	<input
		id={inputId}
		{name}
		type="text"
		{placeholder}
		bind:value
		oninput={handleInput}
		onblur={handleBlur}
		{disabled}
		aria-invalid={hasError || undefined}
		class={[
			'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm transition-colors',
			'placeholder:text-slate-400',
			'focus:border-brand-blue focus:ring-2 focus:ring-brand-blue focus:outline-none',
			'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50',
			hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-300'
		].join(' ')}
	/>

	{#if error}
		<p class="mt-1 text-sm text-red-500">{error}</p>
	{/if}
</div>
