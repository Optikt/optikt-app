<script lang="ts">
	import { resolve } from '$app/paths';
	import { logout } from '$lib/remote/auth.remote';
	import {
		House,
		Users,
		Package,
		ShoppingCart,
		Eye,
		Tag,
		Truck,
		ChartColumn,
		Shield,
		LogOut,
		PanelLeftClose,
		PanelLeftOpen,
		Settings
	} from '@lucide/svelte';
	import { Dropdown, DropdownItem, DropdownHeader, DropdownGroup } from 'flowbite-svelte';
	import { UserRole, isAdminRole } from '$lib/shared/enums';
	import type { LucideIcon } from '$lib/types/index.js';
	import type { SessionWithUser } from '$lib/server/db/queries/sessions.js';
	import NavLink from './NavLink.svelte';

	let { user }: { user: SessionWithUser['user'] } = $props();

	// Icon mapping
	const iconMap: Record<string, LucideIcon> = {
		home: House,
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
			'inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wide justify-center';
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

	let collapsed = $state(false);
</script>

<aside
	class={[
		'flex flex-col bg-linear-to-b from-slate-800 to-slate-900 transition-all duration-300',
		collapsed ? 'w-20' : 'w-64'
	]}
>
	<!-- Header -->
	<div
		class={[
			'flex items-center border-b border-white/10 p-4',
			collapsed ? 'justify-center' : 'justify-between'
		]}
	>
		{#if !collapsed}
			<div class="flex items-center gap-3">
				<img src="/logos/optikt-blue.png" alt="Optikt" class="h-10 w-10 object-contain" />
				<span class="text-xl font-bold text-white">Optikt</span>
			</div>
		{/if}
		<button
			type="button"
			class="flex cursor-pointer items-center justify-center rounded-lg border-none bg-white/10 p-2 text-slate-400 transition-all duration-200 hover:bg-white/20 hover:text-white"
			title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
			onclick={() => (collapsed = !collapsed)}
		>
			{#if collapsed}
				<PanelLeftOpen size={18} />
			{:else}
				<PanelLeftClose size={18} />
			{/if}
		</button>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 overflow-y-auto py-4">
		{#each navItems as item (item.href)}
			<NavLink
				href={item.href}
				label={item.label}
				icon={iconMap[item.icon]}
				{collapsed}
				matchSubPaths
			/>
		{/each}

		{#if isAdmin}
			<div class="mx-4 my-3 h-px bg-white/10"></div>
			{#each adminItems as item (item.href)}
				<NavLink href={item.href} label={item.label} icon={iconMap[item.icon]} {collapsed} />
			{/each}
		{/if}
	</nav>

	<!-- User section with dropdown -->
	<div class={['border-t border-white/10 p-4', collapsed ? 'flex justify-center' : '']}>
		<button
			id="user-menu-button"
			type="button"
			class="flex w-full cursor-pointer items-center gap-3 rounded-lg border-none bg-transparent p-2 transition-all duration-200 hover:bg-white/10"
		>
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-blue to-brand-navy font-semibold text-white"
			>
				{user.fullName?.charAt(0) ?? 'U'}
			</div>
			{#if !collapsed}
				<div class="flex min-w-0 flex-1 flex-col text-left">
					<span class="truncate text-sm font-medium text-white">{user.fullName}</span>
					<span class={getRoleBadgeClass(user.role)}>{user.role}</span>
				</div>
			{/if}
		</button>

		<Dropdown
			triggeredBy="#user-menu-button"
			placement="top"
			class={['w-56 bg-white shadow-lg', { 'ml-2': collapsed }]}
		>
			<DropdownHeader class="border-b border-gray-200">
				<span class="block text-sm font-semibold text-gray-900">{user.fullName}</span>
				<span class="block truncate text-sm text-gray-600">{user.email}</span>
			</DropdownHeader>
			<DropdownGroup>
				<DropdownItem
					href={resolve('/config')}
					class="flex cursor-pointer items-center gap-2 text-gray-700 hover:bg-gray-100! hover:text-gray-900!"
				>
					<Settings size={16} />
					Configuración
				</DropdownItem>
			</DropdownGroup>
			<DropdownGroup>
				<form {...logout} class="contents">
					<button
						type="submit"
						class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
					>
						<LogOut size={16} />
						Cerrar sesión
					</button>
				</form>
			</DropdownGroup>
		</Dropdown>
	</div>
</aside>
