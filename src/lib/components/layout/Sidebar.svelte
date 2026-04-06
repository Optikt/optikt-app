<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		House,
		Users,
		Package,
		ShoppingCart,
		Eye,
		Tag,
		Truck,
		Layers,
		ChartColumn,
		Shield,
		FileText,
		ClipboardList
	} from '@lucide/svelte';
	import { isAdminRole } from '$lib/shared/enums';
	import type { LucideIcon } from '$lib/types/index.js';
	import type { SessionWithUser } from '$lib/server/db/queries/sessions.js';
	import NavLink from './NavLink.svelte';

	type SidebarProps = {
		user: SessionWithUser['user'];
	};

	let { user }: SidebarProps = $props();

	const iconMap: Record<string, LucideIcon> = {
		home: House,
		users: Users,
		package: Package,
		shopping: ShoppingCart,
		eye: Eye,
		tag: Tag,
		truck: Truck,
		layers: Layers,
		reports: ChartColumn,
		shield: Shield,
		quotes: FileText,
		purchases: ClipboardList
	};

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'home' },
		{ href: '/customers', label: 'Clientes', icon: 'users' },
		{ href: '/products', label: 'Inventario', icon: 'package' },
		{ href: '/sales', label: 'Ventas', icon: 'shopping' },
		{ href: '/quotes', label: 'Presupuestos', icon: 'quotes' },
		{ href: '/lenses', label: 'Catálogo Lentes', icon: 'eye' },
		{ href: '/brands', label: 'Marcas', icon: 'tag' },
		{ href: '/materials', label: 'Materiales', icon: 'layers' },
		{ href: '/suppliers', label: 'Proveedores', icon: 'truck' },
		{ href: '/purchases', label: 'Compras', icon: 'purchases' }
	] as const;

	const adminItems = [
		{ href: '/reports', label: 'Reportes', icon: 'reports' },
		{ href: '/users', label: 'Usuarios', icon: 'shield' }
	] as const;

	const isAdmin = $derived(isAdminRole(user.role));
</script>

<aside class="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white print:hidden">
	<!-- Navigation -->
	<nav class="flex-1 overflow-y-auto py-3">
		{#each navItems as item (item.href)}
			<NavLink
				href={resolve(item.href)}
				label={item.label}
				icon={iconMap[item.icon]}
				matchSubPaths
			/>
		{/each}

		{#if isAdmin}
			<div class="mx-4 my-2 h-px bg-slate-200"></div>
			{#each adminItems as item (item.href)}
				<NavLink href={resolve(item.href)} label={item.label} icon={iconMap[item.icon]} />
			{/each}
		{/if}
	</nav>
</aside>
