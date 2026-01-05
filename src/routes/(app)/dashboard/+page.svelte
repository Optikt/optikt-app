<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Component } from 'svelte';
	import {
		Plus,
		Users,
		ShoppingCart,
		Package,
		TriangleAlert,
		UserPlus,
		PackagePlus,
		Eye
	} from '@lucide/svelte';

	let { data } = $props();

	const user = $derived(data.user);

	// Get greeting based on time of day
	const greeting = $derived(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Buenos días';
		if (hour < 18) return 'Buenas tardes';
		return 'Buenas noches';
	});

	// Icon mappings for stats
	const iconMap: Record<string, Component> = {
		users: Users,
		shopping: ShoppingCart,
		package: Package,
		alert: TriangleAlert
	};

	// Color class mappings for stat icons
	const iconColorMap: Record<string, string> = {
		blue: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
		green: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
		purple: 'bg-gradient-to-br from-violet-500 to-violet-600 text-white',
		orange: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white'
	};

	// Action icon mappings
	const actionIconMap: Record<string, Component> = {
		user: UserPlus,
		package: PackagePlus,
		shopping: ShoppingCart,
		eye: Eye
	};

	// Action icon color mappings
	const actionIconColorMap: Record<string, string> = {
		blue: 'bg-blue-500/10 text-blue-500',
		purple: 'bg-violet-500/10 text-violet-500',
		green: 'bg-emerald-500/10 text-emerald-500',
		teal: 'bg-brand-blue/10 text-brand-blue'
	};

	// Quick stats (placeholder for now)
	const stats = [
		{ label: 'Clientes', value: '—', icon: 'users', color: 'blue' },
		{ label: 'Ventas Hoy', value: '—', icon: 'shopping', color: 'green' },
		{ label: 'Productos', value: '—', icon: 'package', color: 'purple' },
		{ label: 'Bajo Stock', value: '—', icon: 'alert', color: 'orange' }
	];

	// Quick actions
	const actions = [
		{ label: 'Nuevo Cliente', href: '/customers', icon: 'user', color: 'blue' },
		{ label: 'Agregar Producto', href: '/products', icon: 'package', color: 'purple' },
		{ label: 'Registrar Venta', href: '/sales', icon: 'shopping', color: 'green' },
		{ label: 'Catálogo de Lentes', href: '/lenses', icon: 'eye', color: 'teal' }
	] as const;
</script>

<svelte:head>
	<title>Dashboard - Optikt</title>
	<meta name="description" content="Optikt Dashboard - Vista general del sistema" />
</svelte:head>

<div class="mx-auto max-w-[1400px] p-8 sm:p-4">
	<header class="mb-8 flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="m-0 text-[1.75rem] font-bold text-brand-navy sm:text-xl">
				{greeting()}, <span class="text-gradient">{user.fullName}</span>
			</h1>
			<p class="mt-1 text-slate-500">Bienvenido al sistema de gestión Optikt</p>
		</div>
		<div class="flex items-center gap-4">
			<button
				class="flex items-center gap-2 rounded-lg border-none bg-linear-to-br from-brand-blue to-brand-navy px-4 py-2.5 font-semibold text-white shadow-[0_4px_14px_rgba(78,181,197,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(78,181,197,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
			>
				<Plus size={20} />
				Nueva Venta
			</button>
		</div>
	</header>

	<!-- Quick Stats -->
	<section class="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat, index (index)}
			{@const Icon = iconMap[stat.icon]}
			<div class="glass-card flex items-center gap-4 p-6">
				<div
					class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl {iconColorMap[
						stat.color
					]}"
				>
					<Icon size={24} />
				</div>
				<div class="flex flex-col">
					<span class="text-[1.75rem] font-bold text-brand-navy">{stat.value}</span>
					<span class="text-sm text-slate-500">{stat.label}</span>
				</div>
			</div>
		{/each}
	</section>

	<!-- Quick Actions -->
	<section class="mt-8">
		<h2 class="mb-4 text-xl font-semibold text-brand-navy">Acciones Rápidas</h2>
		<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
			{#each actions as action (action.href)}
				{@const Icon = actionIconMap[action.icon]}
				<a
					href={resolve(action.href)}
					class="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 font-medium text-brand-navy no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-[0_4px_12px_rgba(78,181,197,0.15)]"
				>
					<div
						class="flex h-12 w-12 items-center justify-center rounded-xl {actionIconColorMap[
							action.color
						]}"
					>
						<Icon size={24} />
					</div>
					<span>{action.label}</span>
				</a>
			{/each}
		</div>
	</section>
</div>
