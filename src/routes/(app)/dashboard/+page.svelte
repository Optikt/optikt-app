<script lang="ts">
	import {
		Users,
		ShoppingCart,
		TriangleAlert,
		UserPlus,
		FileText,
		Eye,
		ChartColumn,
		FilePlus
	} from '@lucide/svelte';
	import {
		DashboardHeader,
		BalanceCard,
		StatCard,
		QuickActionCard,
		RecentSalesTable
	} from '$lib/components/dashboard';
	import { canOperate, isAdminRole } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import { resolve } from '$app/paths';

	let { data } = $props();

	const { stats, recentSales } = $derived(data);
	const canAct = $derived(canOperate(data.user.role));
	const isAdmin = $derived(isAdminRole(data.user.role));

	const lowStockTotal = $derived(stats.lowStockProducts + stats.lowStockLenses);

	const statCards = $derived([
		{
			label: 'Total Clientes',
			value: String(stats.totalCustomers),
			icon: Users,
			color: 'blue' as const,
			subtitle: undefined
		},
		{
			label: 'Ventas de Hoy',
			value: stats.salesToday.count > 0 ? `${stats.salesToday.count}` : '0',
			icon: ShoppingCart,
			color: 'green' as const,
			subtitle: stats.salesToday.count > 0 ? formatPrice(stats.salesToday.total) : undefined
		},
		{
			label: 'Presupuestos Pend.',
			value: String(stats.pendingQuotes),
			icon: FileText,
			color: 'purple' as const,
			subtitle: stats.pendingQuotes > 0 ? 'Activos' : undefined
		},
		{
			label: 'Bajo Stock Mínimo',
			value: String(lowStockTotal),
			icon: TriangleAlert,
			color: 'orange' as const,
			subtitle: lowStockTotal > 0 ? 'Crítico' : undefined
		}
	]);

	const actions = $derived.by(() => {
		const next = [{ label: 'Catálogo', href: resolve('/lenses'), icon: Eye }];

		if (canAct) {
			next.unshift({ label: 'Nuevo Cliente', href: resolve('/customers'), icon: UserPlus });
			next.splice(1, 0, {
				label: 'Nuevo Presupuesto',
				href: resolve('/quotes/new'),
				icon: FilePlus
			});
		}

		if (isAdmin) {
			next.push({ label: 'Reportes', href: resolve('/reports'), icon: ChartColumn });
		}

		return next;
	});
</script>

<svelte:head>
	<title>Dashboard - Optikt</title>
	<meta name="description" content="Optikt Dashboard - Centro de Operaciones" />
</svelte:head>

<div class="p-4">
	<DashboardHeader showPrimaryAction={canAct} />

	<!-- Balance Card -->
	{#if stats.pendingPayments.count > 0}
		<section class="mb-4">
			<BalanceCard amount={stats.pendingPayments.amount} count={stats.pendingPayments.count} />
		</section>
	{/if}

	<!-- Stat Cards -->
	<section class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each statCards as stat (stat.label)}
			<StatCard {...stat} />
		{/each}
	</section>

	<!-- Bottom Grid: Recent Sales + Quick Actions -->
	<section class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Ventas Recientes (2/3 width) -->
		<div class="glass-card p-6 lg:col-span-2">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="font-heading text-lg font-semibold text-brand-navy">Ventas Recientes</h2>
				<a
					href={resolve('/sales')}
					class="text-xs font-semibold tracking-wider text-brand-blue uppercase no-underline transition-colors hover:text-brand-blue-dark"
				>
					Ver Todas
				</a>
			</div>
			<RecentSalesTable sales={recentSales} />
		</div>

		<!-- Acciones Rápidas (1/3 width) - dark navy card -->
		<div class="self-start rounded-xl bg-brand-navy p-6">
			<h2 class="font-heading mb-4 text-xs font-semibold tracking-widest text-brand-gold uppercase">
				Acciones Rápidas
			</h2>
			<div class="grid grid-cols-2 gap-3">
				{#each actions as action (action.href)}
					<QuickActionCard {...action} />
				{/each}
			</div>
		</div>
	</section>
</div>
