<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Input, Helper, Label } from 'flowbite-svelte';
	import { Eye, EyeOff } from '@lucide/svelte';

	interface Props {
		value: string;
		error?: string | null;
		issues?: RemoteFormIssue[]; // From form fields.X.issues()
		label?: string;
		id?: string;
		name?: string;
		placeholder?: string;
		disabled?: boolean;
		autocomplete?: 'off' | 'on' | 'new-password' | 'current-password';
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		required?: boolean;
	}

	let {
		value = $bindable(''),
		error = null,
		issues,
		label,
		id,
		name,
		placeholder = '••••••••',
		disabled = false,
		autocomplete,
		size = 'md',
		class: className,
		required = false
	}: Props = $props();

	// Use name as fallback for id (for the label's "for" attribute)
	const inputId = $derived(id ?? name);

	// Combine error string and issues array
	const displayError = $derived(error || (issues && issues.length > 0 ? issues[0].message : null));
	const hasError = $derived(!!displayError);

	let showPassword = $state(false);
</script>

<div class={className}>
	{#if label}
		<Label for={inputId} color={hasError ? 'red' : undefined}>{label}</Label>
	{/if}
	<div class="relative">
		<Input
			type={showPassword ? 'text' : 'password'}
			id={inputId}
			{name}
			{placeholder}
			{disabled}
			{autocomplete}
			{size}
			class="pr-10 placeholder:text-slate-400"
			bind:value
			color={hasError ? 'red' : undefined}
			{required}
		/>
		<button
			type="button"
			onclick={() => (showPassword = !showPassword)}
			class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0 text-slate-400 transition-colors hover:text-slate-600"
			aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
		>
			{#if showPassword}
				<EyeOff size={18} />
			{:else}
				<Eye size={18} />
			{/if}
		</button>
	</div>
	{#if displayError}
		<Helper color="red">{displayError}</Helper>
	{/if}
</div>
