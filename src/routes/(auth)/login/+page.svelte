<script lang="ts">
	import { Card } from '$lib/components/ui';
	import { LoginForm } from '$lib/components/forms';
</script>

<svelte:head>
	<title>Login - Optikt</title>
	<meta name="description" content="Sign in to Optikt Optical Management System" />
</svelte:head>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-slate-800 to-slate-900 p-4"
>
	<!-- Background decoration -->
	<div class="pointer-events-none absolute inset-0">
		<div
			class="absolute -top-[100px] -right-[100px] h-[400px] w-[400px] rounded-full bg-brand-blue opacity-40 blur-[80px]"
		></div>
		<div
			class="absolute -bottom-[50px] -left-[50px] h-[300px] w-[300px] rounded-full bg-brand-yellow opacity-40 blur-[80px]"
		></div>
		<div
			class="absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue-light opacity-40 blur-[80px]"
		></div>
	</div>

	<Card variant="glass" padding="lg" class="animate-fade-in relative z-10 w-full max-w-[420px]">
		<!-- Logo -->
		<div class="mb-8 text-center">
			<img
				src="/logos/optikt-original.png"
				alt="Optikt Logo"
				class="mx-auto mb-4 h-20 w-20 object-contain"
			/>
			<h1 class="text-gradient m-0 text-2xl font-extrabold">Optikt</h1>
			<p class="mt-1 text-sm text-slate-500">Sistema de Gestión Interna</p>
		</div>

		<!-- Login Form Component -->
		<LoginForm />

		<p class="mt-8 text-center text-xs text-slate-400">
			&copy; {new Date().getFullYear()} Optikt. Todos los derechos reservados.
		</p>
	</Card>
</div>
