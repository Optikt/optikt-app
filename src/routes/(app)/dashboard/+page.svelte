<script lang="ts">
	import {
		Users,
		ShoppingCart,
		ShoppingBag,
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
		RecentSalesTable,
		PendingFreeItemsCard,
		UpcomingPurchasePaymentsWidget
	} from '$lib/components/dashboard';
	import { canOperate, isAdminRole } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import { resolve } from '$app/paths';
	import type { LucideIcon } from '$lib/types/index.js';
	import type { StaticRoute } from '$lib/shared/routes.js';

	let { data } = $props();

	const { stats, recentSales, pendingFreeItemSales, upcomingPurchaseDues } = $derived(data);
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

	type QuickAction = {
		label: string;
		href: StaticRoute;
		icon: LucideIcon;
	};

	const actions: QuickAction[] = $derived.by(() => {
		if (!canAct) {
			return [
				{ label: 'Catálogo', href: '/lenses', icon: Eye },
				{ label: 'Ventas', href: '/sales', icon: ShoppingCart },
				{ label: 'Presupuestos', href: '/quotes', icon: FileText },
				{ label: 'Productos', href: '/products', icon: ShoppingBag }
			];
		}

		const next: QuickAction[] = [
			{ label: 'Nuevo Cliente', href: '/customers', icon: UserPlus },
			{ label: 'Nuevo Presupuesto', href: '/quotes/new', icon: FilePlus },
			{ label: 'Catálogo', href: '/lenses', icon: Eye }
		];

		if (isAdmin) {
			next.push({ label: 'Reportes', href: '/reports', icon: ChartColumn });
		}	

		return next;
	});
</script>

<svelte:head>
	<title>Dashboard - Optikt</title>
	<meta name="description" content="Optikt Dashboard - Centro de Operaciones" />
</svelte:head>

<div class="space-y-4 p-4 sm:space-y-6">
	<DashboardHeader showPrimaryAction={canAct} />

	<!-- Balance Card -->
	{#if stats.pendingPayments.count > 0}
		<section>
			<BalanceCard amount={stats.pendingPayments.amount} count={stats.pendingPayments.count} />
		</section>
	{/if}

	<!-- Stat Cards -->
	<section class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each statCards as stat (stat.label)}
			<StatCard {...stat} />
		{/each}
	</section>

	<!-- Bottom Grid: Recent Sales + Quick Actions + Pending Free Items -->
	<section class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Ventas Recientes (2/3 width) -->
		<div class="glass-card p-4 sm:p-6 lg:col-span-2">
			<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

		<!-- Right column: Quick Actions + Pending Free Items -->
		<div class="flex flex-col gap-6">
			{#if upcomingPurchaseDues.length > 0}
				<UpcomingPurchasePaymentsWidget dues={upcomingPurchaseDues} />
			{/if}

			<!-- Acciones Rápidas - dark navy card -->
			<div class="rounded-xl bg-brand-navy p-4 sm:p-6">
				<h2
					class="font-heading mb-4 text-xs font-semibold tracking-widest text-brand-gold uppercase"
				>
					Acciones Rápidas
				</h2>
				<div class="grid grid-cols-2 gap-3">
					{#each actions as action (action.href)}
						<QuickActionCard {...action} />
					{/each}
				</div>
			</div>

			<!-- Pending Free Items (only shown when there are pending items) -->
			{#if pendingFreeItemSales.length > 0}
				<PendingFreeItemsCard sales={pendingFreeItemSales} />
			{/if}
		</div>
	</section>
</div>
