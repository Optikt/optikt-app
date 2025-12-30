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

<div class="login-container">
	<!-- Background decoration -->
	<div class="bg-decoration">
		<div class="circle circle-1"></div>
		<div class="circle circle-2"></div>
		<div class="circle circle-3"></div>
	</div>

	<Card variant="glass" padding="lg" class="login-card animate-fade-in">
		<!-- Logo -->
		<div class="logo-container">
			<img src="/logos/optikt-original.png" alt="Optikt Logo" class="logo" />
			<h1 class="brand-name">Optikt</h1>
			<p class="tagline">Sistema de Gestión Interna</p>
		</div>

		<!-- Login Form Component -->
		<LoginForm {form} />

		<p class="footer-text">
			&copy; {new Date().getFullYear()} Optikt. Todos los derechos reservados.
		</p>
	</Card>
</div>

<style>
	.login-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
		position: relative;
		overflow: hidden;
	}

	/* Background decoration circles */
	.bg-decoration {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.circle {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.4;
	}

	.circle-1 {
		width: 400px;
		height: 400px;
		background: var(--color-brand-blue);
		top: -100px;
		right: -100px;
	}

	.circle-2 {
		width: 300px;
		height: 300px;
		background: var(--color-brand-yellow);
		bottom: -50px;
		left: -50px;
	}

	.circle-3 {
		width: 200px;
		height: 200px;
		background: var(--color-brand-blue-light);
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	:global(.login-card) {
		width: 100%;
		max-width: 420px;
		position: relative;
		z-index: 10;
	}

	.logo-container {
		text-align: center;
		margin-bottom: 2rem;
	}

	.logo {
		width: 80px;
		height: 80px;
		object-fit: contain;
		margin-bottom: 1rem;
	}

	.brand-name {
		font-size: 2rem;
		font-weight: 800;
		background: linear-gradient(135deg, var(--color-brand-blue) 0%, var(--color-brand-navy) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0;
	}

	.tagline {
		color: #64748b;
		font-size: 0.875rem;
		margin-top: 0.25rem;
	}

	.footer-text {
		text-align: center;
		color: #94a3b8;
		font-size: 0.75rem;
		margin-top: 2rem;
	}

	/* Responsiveness */
	@media (max-width: 480px) {
		:global(.login-card) {
			padding: 1.5rem !important;
		}

		.logo {
			width: 60px;
			height: 60px;
		}

		.brand-name {
			font-size: 1.5rem;
		}
	}
</style>
