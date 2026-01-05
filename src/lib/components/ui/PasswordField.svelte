<script lang="ts">
	import { untrack } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { Eye, EyeOff } from '@lucide/svelte';

	interface Props extends Omit<HTMLInputAttributes, 'class' | 'type'> {
		label?: string;
		error?: string | string[];
		class?: string;
		value?: string;
	}

	let {
		label,
		error,
		class: className = '',
		id,
		value = $bindable(''),
		...restProps
	}: Props = $props();

	// Using untrack - inputId is stable and shouldn't react to id prop changes
	const inputId = untrack(() => id ?? `password-${Math.random().toString(36).slice(2)}`);
	const errorMessage = $derived(Array.isArray(error) ? error[0] : error);
	const hasError = $derived(!!errorMessage);

	let showPassword = $state(false);
</script>

<div class="flex flex-col gap-2 {className}">
	{#if label}
		<label for={inputId} class="form-label">
			{label}
		</label>
	{/if}

	<div class="relative">
		<input
			id={inputId}
			type={showPassword ? 'text' : 'password'}
			class="input-field pr-12 {hasError ? 'input-error' : ''}"
			aria-invalid={hasError}
			aria-describedby={hasError ? `${inputId}-error` : undefined}
			bind:value
			{...restProps}
		/>
		<button
			type="button"
			class="absolute top-1/2 right-3 flex -translate-y-1/2 cursor-pointer items-center justify-center border-none bg-transparent p-1 text-slate-400 transition-colors hover:text-brand-blue"
			onclick={() => (showPassword = !showPassword)}
			aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
		>
			{#if showPassword}
				<EyeOff size={20} />
			{:else}
				<Eye size={20} />
			{/if}
		</button>
	</div>

	{#if hasError}
		<p id="{inputId}-error" class="m-0 text-[0.8125rem] text-red-500">
			{errorMessage}
		</p>
	{/if}
</div>
