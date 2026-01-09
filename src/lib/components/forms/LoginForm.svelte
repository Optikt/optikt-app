<script lang="ts">
	import { login } from '$lib/remote/auth.remote';
	import { Button, Spinner } from 'flowbite-svelte';
	import { CircleAlert, Eye, EyeOff } from '@lucide/svelte';

	// Check if form is loading (pending is a timestamp, 0 when not pending)
	const isLoading = $derived(login.pending > 0);

	// Error message state
	let errorMessage = $state<string | null>(null);

	// Password visibility toggle
	let showPassword = $state(false);

	// Clear error when typing
	function clearError() {
		errorMessage = null;
	}
</script>

{#if errorMessage}
	<div
		class="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-600"
	>
		<CircleAlert size={20} class="shrink-0" />
		<span>{errorMessage}</span>
	</div>
{/if}

<!-- TODO: Create a custom form with error handling -->
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
		<label for="identifier" class="block text-sm font-medium text-brand-navy">
			Usuario o Email
		</label>
		<input
			{...login.fields.identifier.as('text')}
			id="identifier"
			class="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-base transition-all duration-200 placeholder:text-slate-400 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70"
			placeholder="usuario@email.com o usuario"
			autocomplete="username"
			disabled={isLoading}
			oninput={clearError}
		/>
	</div>

	<div class="flex flex-col gap-2">
		<label for="password" class="block text-sm font-medium text-brand-navy"> Contraseña </label>
		<div class="relative">
			<input
				{...login.fields.password.as(showPassword ? 'text' : 'password')}
				id="password"
				class="w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 pr-12 text-base transition-all duration-200 placeholder:text-slate-400 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70"
				placeholder="••••••••"
				autocomplete="current-password"
				disabled={isLoading}
				oninput={clearError}
			/>
			<button
				type="button"
				class="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1 text-slate-400 transition-colors hover:text-brand-blue"
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
	</div>

	<Button type="submit" color="blue" disabled={isLoading} class="mt-2 w-full">
		{#if isLoading}<Spinner size="4" class="mr-2" />{/if}
		{isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
	</Button>
</form>
