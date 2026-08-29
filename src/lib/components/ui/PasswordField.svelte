<script lang="ts">
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { Label } from '$lib/components/ui/label';
	import { Eye, EyeOff } from '@lucide/svelte';
	import { getFormErrorMessage } from '$lib/utils';

	interface Props {
		value: string;
		error?: RemoteFormIssue[] | string | null;
		label?: string;
		id?: string;
		name?: string;
		placeholder?: string;
		disabled?: boolean;
		autocomplete?: 'off' | 'on' | 'new-password' | 'current-password';
		class?: string;
		required?: boolean;
	}

	let {
		value = $bindable(''),
		error = null,
		label,
		id,
		name,
		placeholder = '••••••••',
		disabled = false,
		autocomplete,
		class: className,
		required = false
	}: Props = $props();

	// Use name as fallback for id (for the label's "for" attribute)
	const inputId = $derived(id ?? name);

	// Use unified error handling
	const displayError = $derived(getFormErrorMessage(error));
	const hasError = $derived(!!displayError);

	let showPassword = $state(false);
</script>

<div class={className}>
	{#if label}
		<Label for={inputId} class={hasError ? 'text-red-500' : ''}>{label}</Label>
	{/if}
	<div class="relative">
		<input
			type={showPassword ? 'text' : 'password'}
			id={inputId}
			{name}
			{placeholder}
			{disabled}
			{autocomplete}
			bind:value
			{required}
			aria-invalid={hasError || undefined}
			class={[
				'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm shadow-sm transition-colors',
				'placeholder:text-slate-400',
				'focus:border-brand-blue focus:ring-2 focus:ring-brand-blue focus:outline-none',
				'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50',
				'pr-10',
				hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-300'
			].join(' ')}
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
		<p class="mt-1 text-sm text-red-500">{displayError}</p>
	{/if}
</div>
