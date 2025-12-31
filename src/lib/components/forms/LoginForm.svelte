<script lang="ts">
	import { login } from '$lib/auth.remote';
	import { Button } from '$lib/components/ui';

	// Check if form is loading (pending is a timestamp, 0 when not pending)
	const isLoading = $derived(login.pending > 0);

	// Error message state
	let errorMessage = $state<string | null>(null);

	// Clear error when typing
	function clearError() {
		errorMessage = null;
	}
</script>

{#if errorMessage}
	<div
		class="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-600"
	>
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
			class="flex-shrink-0"
		>
			<circle cx="12" cy="12" r="10"></circle>
			<line x1="12" y1="8" x2="12" y2="12"></line>
			<line x1="12" y1="16" x2="12.01" y2="16"></line>
		</svg>
		<span>{errorMessage}</span>
	</div>
{/if}

<form
	{...login.enhance(async ({ submit, form }) => {
		errorMessage = null;
		try {
			await submit();
			form.reset();
		} catch (e) {
			// HttpError from SvelteKit error() calls
			if (e && typeof e === 'object' && 'body' in e) {
				const body = e.body as { message?: string };
				errorMessage = body.message ?? 'Error al iniciar sesión';
			} else {
				errorMessage = 'Error al iniciar sesión';
			}
		}
	})}
	class="flex flex-col gap-5"
>
	<div class="flex flex-col gap-2">
		<label for="identifier" class="form-label">Usuario o Email</label>
		<input
			{...login.fields.identifier.as('text')}
			id="identifier"
			class="input-field"
			placeholder="usuario@email.com o usuario"
			autocomplete="username"
			disabled={isLoading}
			oninput={clearError}
		/>
	</div>

	<div class="flex flex-col gap-2">
		<label for="password" class="form-label">Contraseña</label>
		<input
			{...login.fields.password.as('password')}
			id="password"
			class="input-field"
			placeholder="••••••••"
			autocomplete="current-password"
			disabled={isLoading}
			oninput={clearError}
		/>
	</div>

	<Button type="submit" loading={isLoading} class="mt-2 w-full">
		{#if isLoading}
			Iniciando sesión...
		{:else}
			Iniciar Sesión
		{/if}
	</Button>
</form>
