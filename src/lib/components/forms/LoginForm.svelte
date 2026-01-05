<script lang="ts">
	import { login } from '$lib/remote/auth.remote';
	import { Button } from '$lib/components/ui';

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
			class="shrink-0"
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
		<label for="password" class="block text-sm font-medium text-brand-navy">
			Contraseña
		</label>
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
				class="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-slate-400 transition-colors hover:text-brand-blue"
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
	</div>

	<Button type="submit" loading={isLoading} class="mt-2 w-full">
		{#if isLoading}
			Iniciando sesión...
		{:else}
			Iniciar Sesión
		{/if}
	</Button>
</form>
