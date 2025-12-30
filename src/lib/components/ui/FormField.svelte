<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'class'> {
		label?: string;
		error?: string | string[];
		hint?: string;
		class?: string;
		value?: string;
	}

	let {
		label,
		error,
		hint,
		class: className = '',
		id: inputId = `input-${Math.random().toString(36).slice(2)}`,
		value = $bindable(''),
		...restProps
	}: Props = $props();

	const errorMessage = $derived(Array.isArray(error) ? error[0] : error);
	const hasError = $derived(!!errorMessage);
</script>

<div class="form-field {className}">
	{#if label}
		<label for={inputId} class="form-label">
			{label}
		</label>
	{/if}

	<input
		id={inputId}
		class="input-field"
		class:input-error={hasError}
		aria-invalid={hasError}
		aria-describedby={hasError ? `${inputId}-error` : undefined}
		bind:value
		{...restProps}
	/>

	{#if hasError}
		<p id="{inputId}-error" class="error-message">
			{errorMessage}
		</p>
	{:else if hint}
		<p class="hint-message">{hint}</p>
	{/if}
</div>

<style>
	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-label {
		font-weight: 500;
		color: var(--color-brand-navy);
		font-size: 0.875rem;
	}

	.input-error {
		border-color: #ef4444 !important;
	}

	.input-error:focus {
		box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15) !important;
	}

	.error-message {
		color: #ef4444;
		font-size: 0.8125rem;
		margin: 0;
	}

	.hint-message {
		color: #64748b;
		font-size: 0.8125rem;
		margin: 0;
	}
</style>
