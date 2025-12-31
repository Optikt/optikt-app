<script lang="ts">
	let { data } = $props();

	const user = $derived(data.user);

	// Get greeting based on time of day
	const greeting = $derived(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Buenos días';
		if (hour < 18) return 'Buenas tardes';
		return 'Buenas noches';
	});

	// Quick stats (placeholder for now)
	const stats = [
		{ label: 'Clientes', value: '—', icon: 'users', color: 'blue' },
		{ label: 'Ventas Hoy', value: '—', icon: 'shopping-cart', color: 'green' },
		{ label: 'Productos', value: '—', icon: 'package', color: 'purple' },
		{ label: 'Bajo Stock', value: '—', icon: 'alert', color: 'orange' }
	];
</script>

<svelte:head>
	<title>Dashboard - Optikt</title>
	<meta name="description" content="Optikt Dashboard - Vista general del sistema" />
</svelte:head>

<div class="dashboard">
	<header class="dashboard-header">
		<div class="welcome">
			<h1 class="greeting">{greeting()}, <span class="text-gradient">{user?.fullName}</span></h1>
			<p class="subtitle">Bienvenido al sistema de gestión Optikt</p>
		</div>
		<div class="header-actions">
			<button class="btn-primary quick-action">
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
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				Nueva Venta
			</button>
		</div>
	</header>

	<!-- Quick Stats -->
	<section class="stats-grid">
		{#each stats as stat, index (index)}
			<div class="stat-card glass-card">
				<div class="stat-icon {stat.color}">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						{#if stat.icon === 'users'}
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
							<circle cx="9" cy="7" r="4"></circle>
							<path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
							<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
						{:else if stat.icon === 'shopping-cart'}
							<circle cx="8" cy="21" r="1"></circle>
							<circle cx="19" cy="21" r="1"></circle>
							<path
								d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"
							></path>
						{:else if stat.icon === 'package'}
							<path d="m7.5 4.27 9 5.15"></path>
							<path
								d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
							></path>
							<path d="m3.3 7 8.7 5 8.7-5"></path>
							<path d="M12 22V12"></path>
						{:else if stat.icon === 'alert'}
							<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
							></path>
							<path d="M12 9v4"></path>
							<path d="M12 17h.01"></path>
						{/if}
					</svg>
				</div>
				<div class="stat-content">
					<span class="stat-value">{stat.value}</span>
					<span class="stat-label">{stat.label}</span>
				</div>
			</div>
		{/each}
	</section>

	<!-- Quick Actions -->
	<section class="quick-actions-section">
		<h2 class="section-title">Acciones Rápidas</h2>
		<div class="actions-grid">
			<a href="/customers" class="action-card">
				<div class="action-icon blue">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
						<circle cx="9" cy="7" r="4"></circle>
						<line x1="19" y1="8" x2="19" y2="14"></line>
						<line x1="22" y1="11" x2="16" y2="11"></line>
					</svg>
				</div>
				<span>Nuevo Cliente</span>
			</a>
			<a href="/products" class="action-card">
				<div class="action-icon purple">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m7.5 4.27 9 5.15"></path>
						<path
							d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
						></path>
						<line x1="12" y1="22" x2="12" y2="12"></line>
					</svg>
				</div>
				<span>Agregar Producto</span>
			</a>
			<a href="/sales" class="action-card">
				<div class="action-icon green">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="8" cy="21" r="1"></circle>
						<circle cx="19" cy="21" r="1"></circle>
						<path
							d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"
						></path>
					</svg>
				</div>
				<span>Registrar Venta</span>
			</a>
			<a href="/lenses" class="action-card">
				<div class="action-icon teal">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path
							d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
						></path>
						<circle cx="12" cy="12" r="3"></circle>
					</svg>
				</div>
				<span>Catálogo de Lentes</span>
			</a>
		</div>
	</section>
</div>

<style>
	.dashboard {
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
	}

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.greeting {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-brand-navy);
		margin: 0;
	}

	.subtitle {
		color: #64748b;
		margin-top: 0.25rem;
	}

	.quick-action {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2.5rem;
	}

	.stat-card {
		padding: 1.5rem;
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.stat-icon {
		width: 56px;
		height: 56px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.stat-icon.blue {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
		color: white;
	}

	.stat-icon.green {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: white;
	}

	.stat-icon.purple {
		background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
		color: white;
	}

	.stat-icon.orange {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		color: white;
	}

	.stat-content {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-brand-navy);
	}

	.stat-label {
		color: #64748b;
		font-size: 0.875rem;
	}

	/* Quick Actions */
	.quick-actions-section {
		margin-top: 2rem;
	}

	.section-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-brand-navy);
		margin-bottom: 1rem;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
	}

	.action-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1.5rem;
		background: white;
		border-radius: 12px;
		border: 1px solid #e2e8f0;
		text-decoration: none;
		color: var(--color-brand-navy);
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.action-card:hover {
		border-color: var(--color-brand-blue);
		box-shadow: 0 4px 12px rgba(78, 181, 197, 0.15);
		transform: translateY(-2px);
	}

	.action-icon {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-icon.blue {
		background: rgba(59, 130, 246, 0.1);
		color: #3b82f6;
	}

	.action-icon.purple {
		background: rgba(139, 92, 246, 0.1);
		color: #8b5cf6;
	}

	.action-icon.green {
		background: rgba(16, 185, 129, 0.1);
		color: #10b981;
	}

	.action-icon.teal {
		background: rgba(78, 181, 197, 0.1);
		color: var(--color-brand-blue);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.dashboard {
			padding: 1rem;
		}

		.greeting {
			font-size: 1.25rem;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
