<script lang="ts">
	import {
		Users,
		ShoppingCart,
		TriangleAlert,
		UserPlus,
		PackagePlus,
		Eye,
		FileText,
		CreditCard,
		ArrowRight
	} from '@lucide/svelte';
	import {
		DashboardHeader,
		StatCard,
		QuickActionCard,
		RecentSalesTable,
		LowStockList
	} from '$lib/components/dashboard';
	import { formatPrice } from '$lib/utils';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const user = $derived(data.user);
	const { stats, recentSales, lowStockItems } = $derived(data);

	const lowStockTotal = $derived(stats.lowStockProducts + stats.lowStockLenses);

	const statCards = $derived([
		{ label: 'Clientes', value: String(stats.totalCustomers), icon: Users, color: 'blue' as const },
		{
			label: 'Ventas Hoy',
			value:
				stats.salesToday.count > 0
					? `${stats.salesToday.count} · ${formatPrice(stats.salesToday.total)}`
					: '0',
			icon: ShoppingCart,
			color: 'green' as const
		},
		{
			label: 'Presupuestos Pendientes',
			value: String(stats.pendingQuotes),
			icon: FileText,
			color: 'purple' as const
		},
		{
			label: 'Bajo Stock',
			value: String(lowStockTotal),
			icon: TriangleAlert,
			color: 'orange' as const
		}
	]);

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
		{#each statCards as stat (stat.label)}
			<StatCard {...stat} />
		{/each}
	</section>

	<!-- Pending Payments Banner -->
	{#if stats.pendingPayments.count > 0}
		<section class="mb-8">
			<a
				href="{resolve('/sales')}?status=PENDING"
				class="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-6 py-4 no-underline transition-colors hover:bg-amber-100"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600"
					>
						<CreditCard size={20} />
					</div>
					<div>
						<p class="text-sm font-semibold text-amber-800">
							{stats.pendingPayments.count} venta{stats.pendingPayments.count !== 1 ? 's' : ''} con cobro
							pendiente
						</p>
						<p class="font-mono text-xs text-amber-600">
							{formatPrice(stats.pendingPayments.amount)} por cobrar
						</p>
					</div>
				</div>
				<ArrowRight size={18} class="text-amber-400" />
			</a>
		</section>
	{/if}

	<!-- Content Grid: Recent Sales + Low Stock -->
	<section class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Recent Sales -->
		<div class="glass-card p-6">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-brand-navy">Ventas Recientes</h2>
				<a
					href={resolve('/sales')}
					class="text-sm text-slate-400 no-underline transition-colors hover:text-brand-blue"
				>
					Ver todas
				</a>
			</div>
			<RecentSalesTable sales={recentSales} />
		</div>

		<!-- Low Stock -->
		<div class="glass-card p-6">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-brand-navy">Bajo Stock</h2>
				<a
					href="{resolve('/products')}?lowStockOnly=true"
					class="text-sm text-slate-400 no-underline transition-colors hover:text-brand-blue"
				>
					Ver todos
				</a>
			</div>
			<LowStockList items={lowStockItems} />
		</div>
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
