<script lang="ts">
	import { ImagotipoVertical, Isotipo } from '$lib/components';
	import { LoginForm } from '$lib/components/forms';

	const appVersion = __APP_VERSION__;
</script>

<svelte:head>
	<title>Login - Optikt</title>
	<meta name="description" content="Inicie sesión en Optikt - Sistema de Gestión Óptica" />
</svelte:head>

<div class="flex min-h-screen">
	<!-- ── Left Panel - Brand showcase ──────────────────────────────────── -->
	<div
		class="relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 lg:flex"
		style="background: linear-gradient(160deg, var(--color-brand-navy) 0%, var(--color-brand-navy-dark) 100%)"
	>
		<!-- Top spacer -->
		<div></div>

		<!-- Logo + tagline (centered) -->
		<div class="mx-auto flex max-w-lg flex-col items-center text-center">
			<ImagotipoVertical theme="light" ariaLabel="Optikt" class="mb-8 h-48 w-auto xl:h-56" />
			<p class="text-lg leading-relaxed text-white/60">
				Transformando la visión, impulsando tu negocio.
			</p>
		</div>

		<!-- Version (bottom-left) -->
		<!-- brand-gold -->
		<!-- <p class="text-xs tracking-widest text-white/30 uppercase">Optik-T App v{appVersion}</p> -->
		<p class="text-xs tracking-widest text-brand-gold/80 uppercase">Optik-T App v{appVersion}</p>
	</div>

	<!-- ── Right Panel - Login form ────────────────────────────────────── -->
	<div
		class="flex w-full flex-col items-center justify-center px-6 py-10 lg:w-1/2"
		style="background-color: var(--color-surface-container-low)"
	>
		<!-- System badge (top-right) -->
		<div class="absolute top-6 right-8 hidden items-center gap-2 lg:flex">
			<span class="text-xs tracking-wide text-on-surface-variant uppercase">
				Sistema Operativo
			</span>
			<span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
		</div>

		<div class="w-full max-w-sm">
			<!-- Logo -->
			<div class="mb-10 text-center">
				<Isotipo ariaLabel="Optikt Logo" class="mx-auto mb-6 h-16 w-16" />
				<h2 class="font-heading text-3xl font-bold text-on-surface">Bienvenido de nuevo</h2>
				<p class="mt-2 text-base text-on-surface-variant">
					Ingrese sus credenciales para acceder al panel de control.
				</p>
			</div>

			<!-- Login Form -->
			<LoginForm />
		</div>
	</div>
</div>
