<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm, type Infer, type SuperValidated } from 'sveltekit-superforms';
	import type { loginSchema } from '$lib/schemas/auth';
	import { Card } from '$lib/components/ui';
	import { LoginForm } from '$lib/components/forms';

	interface Props {
		data: {
			form: SuperValidated<Infer<typeof loginSchema>>;
		};
	}

	let { data }: Props = $props();

	/**
	 * Using untrack() to intentionally capture the initial form value.
	 * SuperForms manages its own internal reactive state - it doesn't need
	 * to re-initialize when data.form changes. Making this reactive would
	 * incorrectly reset the form on every server response.
	 *
	 * This addresses the Svelte 5.45.3+ state_referenced_locally warning
	 * introduced in sveltejs/svelte#17266, which now applies to props.
	 * The warning is a false positive for this legitimate pattern.
	 */
	const form = superForm(untrack(() => data.form));
</script>

<svelte:head>
	<title>Login - Optikt</title>
	<meta name="description" content="Sign in to Optikt Optical Management System" />
</svelte:head>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 p-4"
>
	<!-- Background decoration -->
	<div class="pointer-events-none absolute inset-0">
		<div
			class="absolute -top-[100px] -right-[100px] h-[400px] w-[400px] rounded-full bg-[var(--color-brand-blue)] opacity-40 blur-[80px]"
		></div>
		<div
			class="absolute -bottom-[50px] -left-[50px] h-[300px] w-[300px] rounded-full bg-[var(--color-brand-yellow)] opacity-40 blur-[80px]"
		></div>
		<div
			class="absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-brand-blue-light)] opacity-40 blur-[80px]"
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
		<LoginForm {form} />

		<p class="mt-8 text-center text-xs text-slate-400">
			&copy; {new Date().getFullYear()} Optikt. Todos los derechos reservados.
		</p>
	</Card>
</div>
