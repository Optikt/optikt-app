<script lang="ts">
	import { page } from '$app/state';
	import { logout } from '$lib/remote/auth.remote';
	import { resolve } from '$app/paths';

	let { children, data } = $props();

	const user = $derived(data.user);

	// Navigation items
	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'home' },
		{ href: '/customers', label: 'Clientes', icon: 'users' },
		{ href: '/products', label: 'Productos', icon: 'package' },
		{ href: '/sales', label: 'Ventas', icon: 'shopping-cart' },
		{ href: '/lenses', label: 'Lentes', icon: 'eye' },
		{ href: '/brands', label: 'Marcas', icon: 'tag' },
		{ href: '/suppliers', label: 'Proveedores', icon: 'truck' }
	] as const;

	// Only show reports and users for admins
	const adminItems = [
		{ href: '/reports', label: 'Reportes', icon: 'bar-chart' },
		{ href: '/users', label: 'Usuarios', icon: 'shield' }
	] as const;

	const isAdmin = $derived(
		user?.role === 'SUPERADMIN' || user?.role === 'ADMIN' || user?.role === 'MANAGER'
	);

	// Role badge colors - Tailwind classes
	function getRoleBadgeClass(role: string) {
		const base =
			'inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase tracking-wide';
		switch (role) {
			case 'SUPERADMIN':
				return `${base} text-white bg-gradient-to-r from-amber-500 to-amber-600`;
			case 'ADMIN':
				return `${base} text-white bg-gradient-to-r from-violet-500 to-violet-600`;
			case 'MANAGER':
				return `${base} text-white bg-gradient-to-r from-blue-500 to-blue-600`;
			case 'SELLER':
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
				<a
					href={resolve(item.href)}
					class="mx-3 my-1 flex items-center gap-3 rounded-lg px-4 py-3 text-slate-400 no-underline transition-all duration-200 hover:bg-white/10 hover:text-white"
					class:bg-[rgba(78,181,197,0.2)]={page.url.pathname === item.href ||
						page.url.pathname.startsWith(item.href + '/')}
					class:text-[var(--color-brand-blue)]={page.url.pathname === item.href ||
						page.url.pathname.startsWith(item.href + '/')}
				>
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
						{#if item.icon === 'home'}
							<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
							<polyline points="9 22 9 12 15 12 15 22"></polyline>
						{:else if item.icon === 'users'}
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
							<circle cx="9" cy="7" r="4"></circle>
							<path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
							<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
						{:else if item.icon === 'package'}
							<path d="m7.5 4.27 9 5.15"></path>
							<path
								d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
							></path>
							<path d="m3.3 7 8.7 5 8.7-5"></path>
							<path d="M12 22V12"></path>
						{:else if item.icon === 'shopping-cart'}
							<circle cx="8" cy="21" r="1"></circle>
							<circle cx="19" cy="21" r="1"></circle>
							<path
								d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"
							></path>
						{:else if item.icon === 'eye'}
							<path
								d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
							></path>
							<circle cx="12" cy="12" r="3"></circle>
						{:else if item.icon === 'tag'}
							<path
								d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"
							></path>
							<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"></circle>
						{:else if item.icon === 'truck'}
							<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path>
							<path d="M15 18H9"></path>
							<path
								d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"
							></path>
							<circle cx="17" cy="18" r="2"></circle>
							<circle cx="7" cy="18" r="2"></circle>
						{/if}
					</svg>
					{#if sidebarOpen}
						<span>{item.label}</span>
					{/if}
				</a>
			{/each}

			{#if isAdmin}
				<div class="mx-4 my-3 h-px bg-white/10"></div>
				{#each adminItems as item, index (index)}
					<a
						href={resolve(item.href)}
						class="mx-3 my-1 flex items-center gap-3 rounded-lg px-4 py-3 text-slate-400 no-underline transition-all duration-200 hover:bg-white/10 hover:text-white"
						class:bg-[rgba(78,181,197,0.2)]={page.url.pathname === item.href}
						class:text-[var(--color-brand-blue)]={page.url.pathname === item.href}
					>
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
							{#if item.icon === 'bar-chart'}
								<line x1="12" y1="20" x2="12" y2="10"></line>
								<line x1="18" y1="20" x2="18" y2="4"></line>
								<line x1="6" y1="20" x2="6" y2="16"></line>
							{:else if item.icon === 'shield'}
								<path
									d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
								></path>
							{/if}
						</svg>
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
						<span class={getRoleBadgeClass(user?.role ?? 'VIEWER')}>{user?.role}</span>
					</div>
				{/if}
			</div>
			<form {...logout} class="contents">
				<button
					type="submit"
					class="flex cursor-pointer items-center justify-center rounded-lg border-none bg-white/10 p-2 text-slate-400 transition-all duration-200 hover:bg-red-500/20 hover:text-red-500"
					title="Cerrar sesión"
				>
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
						<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
						<polyline points="16 17 21 12 16 7"></polyline>
						<line x1="21" y1="12" x2="9" y2="12"></line>
					</svg>
				</button>
			</form>
		</div>
	</aside>

	<!-- Main content -->
	<main class="min-h-screen flex-1 overflow-y-auto bg-slate-50">
		{@render children()}
	</main>
</div>
