<script lang="ts">
	import {
		Users,
		ShoppingCart,
		Package,
		TriangleAlert,
		UserPlus,
		PackagePlus,
		Eye
	} from '@lucide/svelte';
	import { DashboardHeader, StatCard, QuickActionCard } from '$lib/components/dashboard';

	let { data } = $props();

	const user = $derived(data.user);

	// Quick stats (placeholder for now)
	const stats = [
		{ label: 'Clientes', value: '—', icon: Users, color: 'blue' as const },
		{ label: 'Ventas Hoy', value: '—', icon: ShoppingCart, color: 'green' as const },
		{ label: 'Productos', value: '—', icon: Package, color: 'purple' as const },
		{ label: 'Bajo Stock', value: '—', icon: TriangleAlert, color: 'orange' as const }
	];

	// Quick actions
	const actions = [
		{ label: 'Nuevo Cliente', href: '/customers', icon: UserPlus, color: 'blue' as const },
		{
			label: 'Agregar Producto',
			href: '/products',
			icon: PackagePlus,
			color: 'purple' as const
		},
		{
			label: 'Registrar Venta',
			href: '/sales',
			icon: ShoppingCart,
			color: 'green' as const
		},
		{ label: 'Catálogo de Lentes', href: '/lenses', icon: Eye, color: 'teal' as const }
	] as const;
</script>

<svelte:head>
	<title>Dashboard - Optikt</title>
	<meta name="description" content="Optikt Dashboard - Vista general del sistema" />
</svelte:head>

<div class="mx-auto max-w-[1400px] p-8 sm:p-4">
	<DashboardHeader userName={user.fullName} />

	<!-- Quick Stats -->
	<section class="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat (stat.label)}
			<StatCard {...stat} />
		{/each}
	</section>

	<!-- Quick Actions -->
	<section class="mt-8">
		<h2 class="mb-4 text-xl font-semibold text-brand-navy">Acciones Rápidas</h2>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each actions as action (action.href)}
				<QuickActionCard {...action} />
			{/each}
		</div>
	</section>
</div>
