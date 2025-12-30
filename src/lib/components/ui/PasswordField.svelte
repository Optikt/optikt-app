<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

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
		id:inputId = `password-${Math.random().toString(36).slice(2)}`,
		value = $bindable(''),
		...restProps
	}: Props = $props();

	const errorMessage = $derived(Array.isArray(error) ? error[0] : error);
	const hasError = $derived(!!errorMessage);

	let showPassword = $state(false);
</script>

<div class="form-field {className}">
	{#if label}
		<label for={inputId} class="form-label">
			{label}
		</label>
	{/if}

	<div class="password-wrapper">
		<input
			id={inputId}
			type={showPassword ? 'text' : 'password'}
			class="input-field"
			class:input-error={hasError}
			aria-invalid={hasError}
			aria-describedby={hasError ? `${inputId}-error` : undefined}
			bind:value
			{...restProps}
		/>
		<button
			type="button"
			class="toggle-btn"
			onclick={() => (showPassword = !showPassword)}
			aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
		>
			{#if showPassword}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
					></path>
					<line x1="1" y1="1" x2="23" y2="23"></line>
				</svg>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
					<circle cx="12" cy="12" r="3"></circle>
				</svg>
			{/if}
		</button>
	</div>

	{#if hasError}
		<p id="{inputId}-error" class="error-message">
			{errorMessage}
		</p>
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

	.password-wrapper {
		position: relative;
	}

	.password-wrapper :global(.input-field) {
		padding-right: 3rem;
	}

	.toggle-btn {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.2s ease;
	}

	.toggle-btn:hover {
		color: var(--color-brand-blue);
	}

	.input-error {
		border-color: #ef4444 !important;
	}

	.error-message {
		color: #ef4444;
		font-size: 0.8125rem;
		margin: 0;
	}
</style>
