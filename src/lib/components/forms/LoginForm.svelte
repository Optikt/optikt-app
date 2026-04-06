<script lang="ts">
	import { login } from '$lib/remote/auth.remote';
	import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, Mail } from '@lucide/svelte';

	const isLoading = $derived(login.pending > 0);
	let errorMessage = $state<string | null>(null);
	let showPassword = $state(false);

	function clearError() {
		errorMessage = null;
	}
</script>

{#if errorMessage}
	<div
		class="mb-4 flex items-center gap-3 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container"
	>
		<CircleAlert size={18} class="shrink-0" />
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
			if (e && typeof e === 'object' && 'body' in e) {
				const body = e.body as { message?: string };
				errorMessage = body.message ?? 'Error al iniciar sesión';
			} else {
				errorMessage = 'Error al iniciar sesión';
			}
			console.error(e);
		}
	})}
	class="flex flex-col gap-5"
>
	<!-- Email -->
	<div class="flex flex-col gap-1.5">
		<label
			for="identifier"
			class="text-[0.8125rem] font-medium tracking-wider text-on-surface-variant uppercase"
		>
			Correo Electrónico
		</label>
		<div class="relative">
			<span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-outline">
				<Mail size={18} />
			</span>
			<input
				{...login.fields.identifier.as('text')}
				id="identifier"
				class="w-full rounded-md border-0 bg-surface-container-high py-3 pr-4 pl-10 text-base text-on-surface transition-colors duration-150 placeholder:text-outline focus:bg-surface-container-highest focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
				placeholder="correo@optikt.com"
				autocomplete="username"
				disabled={isLoading}
				oninput={clearError}
			/>
		</div>
	</div>

	<!-- Password -->
	<div class="flex flex-col gap-1.5">
		<label
			for="password"
			class="text-[0.8125rem] font-medium tracking-wider text-on-surface-variant uppercase"
		>
			Contraseña
		</label>
		<div class="relative">
			<span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-outline">
				<Lock size={18} />
			</span>
			<input
				{...login.fields.password.as(showPassword ? 'text' : 'password')}
				id="password"
				class="w-full rounded-md border-0 bg-surface-container-high py-3 pr-12 pl-10 text-base text-on-surface transition-colors duration-150 placeholder:text-outline focus:bg-surface-container-highest focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
				placeholder="••••••••••••"
				autocomplete="current-password"
				disabled={isLoading}
				oninput={clearError}
			/>
			<button
				type="button"
				class="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-outline transition-colors hover:text-on-surface"
				onclick={() => (showPassword = !showPassword)}
				aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
			>
				{#if showPassword}
					<EyeOff size={18} />
				{:else}
					<Eye size={18} />
				{/if}
			</button>
		</div>
	</div>

	<!-- Submit -->
	<button
		type="submit"
		disabled={isLoading}
		class="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold py-3.5 text-sm font-semibold tracking-wider text-on-secondary uppercase transition-all duration-150 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
	>
		{#if isLoading}
			<span class="spinner"></span>
			Iniciando sesión…
		{:else}
			Iniciar Sesión
			<ArrowRight size={18} />
		{/if}
	</button>
</form>
