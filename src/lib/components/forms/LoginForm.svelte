<script lang="ts">
	import { untrack } from 'svelte';
	import type { Infer, SuperForm } from 'sveltekit-superforms';
	import type { loginSchema } from '$lib/schemas/auth';
	import { FormField, PasswordField, Button, FormAlert } from '$lib/components/ui';

	interface Props {
		form: SuperForm<Infer<typeof loginSchema>>;
	}

	let { form: superform }: Props = $props();

	/**
	 * Using untrack() to capture form methods at component creation.
	 * SuperForms manages its own reactive state internally - these methods
	 * don't need to be reactive to prop changes.
	 *
	 * This addresses the Svelte 5.45.3+ state_referenced_locally warning
	 * (sveltejs/svelte#17266) which is a false positive for this pattern.
	 */
	const { form, errors, enhance, delayed, message } = untrack(() => superform);
</script>

<FormAlert message={$message}>
	<form method="POST" use:enhance class="login-form">
		<FormField
			label="Usuario o Email"
			name="identifier"
			type="text"
			placeholder="usuario@email.com o usuario"
			autocomplete="username"
			bind:value={$form.identifier}
			error={$errors.identifier}
			disabled={$delayed}
		/>

		<PasswordField
			label="Contraseña"
			name="password"
			placeholder="••••••••"
			autocomplete="current-password"
			bind:value={$form.password}
			error={$errors.password}
			disabled={$delayed}
		/>

		<Button type="submit" loading={$delayed} class="submit-btn">
			{#if $delayed}
				Iniciando sesión...
			{:else}
				Iniciar Sesión
			{/if}
		</Button>
	</form>
</FormAlert>

<style>
	.login-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	:global(.submit-btn) {
		width: 100%;
		margin-top: 0.5rem;
	}
</style>
