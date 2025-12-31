<script lang="ts">
	import { page } from '$app/state';
	import { logout } from '$lib/remote/auth.remote';
	import { resolve } from '$app/paths';
	import {
		Home,
		Users,
		Package,
		ShoppingCart,
		Eye,
		Tag,
		Truck,
		ChartColumn,
		Shield,
		LogOut
	} from 'lucide-svelte';
	import type { ComponentType } from 'svelte';
	import { UserRole, isAdminRole } from '$lib/shared/enums';

	let { children, data } = $props();

	const user = $derived(data.user);

	// Icon mapping
	const iconMap: Record<string, ComponentType> = {
		home: Home,
		users: Users,
		package: Package,
		shopping: ShoppingCart,
		eye: Eye,
		tag: Tag,
		truck: Truck,
		reports: ChartColumn,
		shield: Shield
	};

	// Navigation items
	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'home' },
		{ href: '/customers', label: 'Clientes', icon: 'users' },
		{ href: '/products', label: 'Productos', icon: 'package' },
		{ href: '/sales', label: 'Ventas', icon: 'shopping' },
		{ href: '/lenses', label: 'Lentes', icon: 'eye' },
		{ href: '/brands', label: 'Marcas', icon: 'tag' },
		{ href: '/suppliers', label: 'Proveedores', icon: 'truck' }
	] as const;

	// Only show reports and users for admins
	const adminItems = [
		{ href: '/reports', label: 'Reportes', icon: 'reports' },
		{ href: '/users', label: 'Usuarios', icon: 'shield' }
	] as const;

	const isAdmin = $derived(isAdminRole(user.role));

	// Role badge colors - Tailwind classes
	function getRoleBadgeClass(role: UserRole) {
		const base =
			'inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wide';
		switch (role) {
			case UserRole.SUPERADMIN:
				return `${base} text-white bg-gradient-to-r from-amber-500 to-amber-600`;
			case UserRole.ADMIN:
				return `${base} text-white bg-gradient-to-r from-violet-500 to-violet-600`;
			case UserRole.MANAGER:
				return `${base} text-white bg-gradient-to-r from-blue-500 to-blue-600`;
			case UserRole.SELLER:
				return `${base} text-white bg-gradient-to-r from-emerald-500 to-emerald-600`;
			default:
				return `${base} text-white bg-gradient-to-r from-gray-500 to-gray-600`;
		}
	}

	let sidebarOpen = $state(true);
</script>

<div class="flex min-h-screen">
	<!-- Sidebar -->
	<aside
		class="flex w-64 flex-col bg-linear-to-b from-slate-800 to-slate-900 transition-all duration-300"
		class:w-20={!sidebarOpen}
	>
		<!-- Header -->
		<div class="flex items-center gap-3 border-b border-white/10 p-6">
			<img src="/logos/optikt-blue.png" alt="Optikt" class="h-10 w-10 object-contain" />
			{#if sidebarOpen}
				<span class="text-xl font-bold text-white">Optikt</span>
			{/if}
		</div>

		<!-- Navigation -->
		<nav class="flex-1 overflow-y-auto py-4">
			{#each navItems as item, index (index)}
				{@const Icon = iconMap[item.icon]}
				<a
					title={item.label}
					href={resolve(item.href)}
					class="mx-3 my-1 flex items-center gap-3 rounded-lg px-4 py-3 text-slate-400 no-underline transition-all duration-200 hover:bg-white/10 hover:text-white"
					class:bg-[rgba(78,181,197,0.2)]={page.url.pathname === item.href ||
						page.url.pathname.startsWith(item.href + '/')}
					class:text-[var(--color-brand-blue)]={page.url.pathname === item.href ||
						page.url.pathname.startsWith(item.href + '/')}
				>
					<Icon size={20} />
					{#if sidebarOpen}
						<span>{item.label}</span>
					{/if}
				</a>
			{/each}

			{#if isAdmin}
				<div class="mx-4 my-3 h-px bg-white/10"></div>
				{#each adminItems as item, index (index)}
					{@const Icon = iconMap[item.icon]}
					<a
						title={item.label}
						href={resolve(item.href)}
						class="mx-3 my-1 flex items-center gap-3 rounded-lg px-4 py-3 text-slate-400 no-underline transition-all duration-200 hover:bg-white/10 hover:text-white"
						class:bg-[rgba(78,181,197,0.2)]={page.url.pathname === item.href}
						class:text-[var(--color-brand-blue)]={page.url.pathname === item.href}
					>
						<Icon size={20} />
						{#if sidebarOpen}
							<span>{item.label}</span>
						{/if}
					</a>
				{/each}
			{/if}
		</nav>

		<!-- User section -->
		<div class="flex items-center justify-between gap-3 border-t border-white/10 p-4">
			<div class="flex min-w-0 flex-1 items-center gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-blue to-brand-navy font-semibold text-white"
				>
					{user?.fullName?.charAt(0) ?? 'U'}
				</div>
				{#if sidebarOpen}
					<div class="flex min-w-0 flex-col">
						<span class="truncate text-sm font-medium text-white">{user?.fullName}</span>
						<span class={getRoleBadgeClass(user?.role ?? UserRole.VIEWER)}>{user?.role}</span>
					</div>
				{/if}
			</div>
			<form {...logout} class="contents">
				<button
					type="submit"
					class="flex cursor-pointer items-center justify-center rounded-lg border-none bg-white/10 p-2 text-slate-400 transition-all duration-200 hover:bg-red-500/20 hover:text-red-500"
					title="Cerrar sesión"
				>
					<LogOut size={20} />
				</button>
			</form>
		</div>
	</aside>

	<!-- Main content -->
	<main class="min-h-screen flex-1 overflow-y-auto bg-slate-50">
		{@render children()}
	</main>
</div>
