<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';

	const { form, data } = $props();

	let isLoading = $state(false);
	let showPassword = $state(false);
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

	<div class="login-card glass-card animate-fade-in">
		<!-- Logo -->
		<div class="logo-container">
			<img src="/logos/optikt-original.png" alt="Optikt Logo" class="logo" />
			<h1 class="brand-name">Optikt</h1>
			<p class="tagline">Sistema de Gestión Óptica</p>
		</div>

		<!-- Login Form -->
		<form
			method="POST"
			class="login-form"
			use:enhance={() => {
				isLoading = true;
				return async ({ update }) => {
					await update();
					isLoading = false;
				};
			}}
		>
			{#if form?.message}
				<div class="error-alert animate-fade-in">
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
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12" y2="12"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
					<span>{form.message}</span>
				</div>
			{/if}

			<div class="form-group">
				<label for="identifier" class="input-label">Usuario o Email</label>
				<input
					type="text"
					id="identifier"
					name="identifier"
					class="input-field"
					placeholder="usuario@email.com o usuario"
					required
					autocomplete="username"
					disabled={isLoading}
				/>
			</div>

			<div class="form-group">
				<label for="password" class="input-label">Contraseña</label>
				<div class="password-wrapper">
					<input
						type={showPassword ? 'text' : 'password'}
						id="password"
						name="password"
						class="input-field"
						placeholder="••••••••"
						required
						autocomplete="current-password"
						disabled={isLoading}
					/>
					<button
						type="button"
						class="password-toggle"
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

			<button type="submit" class="btn-primary submit-btn" disabled={isLoading}>
				{#if isLoading}
					<span class="spinner"></span>
					Iniciando sesión...
				{:else}
					Iniciar Sesión
				{/if}
			</button>
		</form>

		<p class="footer-text">
			&copy; {new Date().getFullYear()} Optikt. Todos los derechos reservados.
		</p>
	</div>
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

	.login-card {
		width: 100%;
		max-width: 420px;
		padding: 2.5rem;
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

	.login-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.password-wrapper {
		position: relative;
	}

	.password-wrapper .input-field {
		padding-right: 3rem;
	}

	.password-toggle {
		position: absolute;
		right: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.2s ease;
	}

	.password-toggle:hover {
		color: var(--color-brand-blue);
	}

	.error-alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		color: #dc2626;
		font-size: 0.875rem;
	}

	.submit-btn {
		width: 100%;
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.submit-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
		transform: none;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.footer-text {
		text-align: center;
		color: #94a3b8;
		font-size: 0.75rem;
		margin-top: 2rem;
	}

	/* Responsiveness */
	@media (max-width: 480px) {
		.login-card {
			padding: 1.5rem;
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
