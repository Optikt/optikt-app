<script lang="ts">
	import { untrack } from 'svelte';
	import type { Infer, SuperForm } from 'sveltekit-superforms';
	import type { loginSchema } from '$lib/schemas/auth';
	import { FormField, PasswordField, Button, FormAlert } from '$lib/components/ui';

	interface Props {
		form: SuperForm<Infer<typeof loginSchema>>;
	}

	let { form: superform }: Props = $props();

	// Using untrack() because we know that the super form is not reactive to prop
	const { form, errors, enhance, delayed, message } = untrack(() => superform);
</script>

<FormAlert message={$message}>
	<form method="POST" use:enhance class="flex flex-col gap-5">
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

		<Button type="submit" loading={$delayed} class="mt-2 w-full">
			{#if $delayed}
				Iniciando sesión...
			{:else}
				Iniciar Sesión
			{/if}
		</Button>
	</form>
</FormAlert>
