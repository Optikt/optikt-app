<script lang="ts">
	import { X } from '@lucide/svelte';
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
		ClipboardList,
		HandCoins,
		Wallet
	} from '@lucide/svelte';
	import { getInventoryCountContext } from '$lib/context';
	import { isAdminRole, UserRole } from '$lib/shared/enums';
	import { NAV_ITEMS, ADMIN_ITEMS, SUPER_ADMIN_ITEMS } from '$lib/shared/routes';
	import type { LucideIcon } from '$lib/types/index.js';
	import type { SessionWithUser } from '$lib/server/db/queries/sessions.js';
	import NavLink from './NavLink.svelte';

	type SidebarProps = {
		user: SessionWithUser['user'];
		mobileOpen?: boolean;
		collapsed?: boolean;
		onClose?: () => void;
	};

	let { user, mobileOpen = false, collapsed = false, onClose }: SidebarProps = $props();
	const inventoryCountContext = getInventoryCountContext();

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
		purchases: ClipboardList,
		receivables: HandCoins,
		wallet: Wallet
	};

	const navItems = NAV_ITEMS;
	const adminManagerItems = ADMIN_ITEMS;
	const adminOnlyItems = SUPER_ADMIN_ITEMS;

	const isAdminOrManager = $derived(isAdminRole(user.role));
	const isAdmin = $derived(user.role === UserRole.ADMIN);
</script>

{#snippet navigation(onSelect = undefined as (() => void) | undefined, compact = false)}
	{#each navItems as item (item.href)}
		<NavLink
			href={item.href}
			label={item.label}
			icon={iconMap[item.icon]}
			matchSubPaths
			collapsed={compact}
			{onSelect}
		/>
	{/each}

	<NavLink
		href="/inventory/count"
		label="Conteo Físico"
		icon={ClipboardList}
		badge={inventoryCountContext.activeSession ? 'EN PROGRESO' : undefined}
		badgeDisplay="dot"
		matchSubPaths
		collapsed={compact}
		{onSelect}
	/>

	{#if isAdminOrManager}
		<div class={['my-2 h-px bg-slate-200', compact ? 'mx-3' : 'mx-4']}></div>
		{#each adminManagerItems as item (item.href)}
			<NavLink
				href={item.href}
				label={item.label}
				icon={iconMap[item.icon]}
				collapsed={compact}
				{onSelect}
			/>
		{/each}
	{/if}

	{#if isAdmin}
		{#each adminOnlyItems as item (item.href)}
			<NavLink
				href={item.href}
				label={item.label}
				icon={iconMap[item.icon]}
				collapsed={compact}
				{onSelect}
			/>
		{/each}
	{/if}
{/snippet}

<aside
	class={[
		'hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-out lg:flex print:hidden',
		collapsed ? 'w-16' : 'w-60'
	]}
>
	<nav class="flex-1 overflow-y-auto py-3">
		{@render navigation(undefined, collapsed)}
	</nav>
</aside>

{#if mobileOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-brand-navy/30 backdrop-blur-[1px] lg:hidden"
		onclick={onClose}
		aria-label="Cerrar menú de navegación"
	></button>
{/if}

<aside
	id="app-mobile-sidebar"
	class={[
		'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-2rem))] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden print:hidden',
		mobileOpen ? 'translate-x-0' : '-translate-x-full'
	]}
>
	<div class="flex items-center justify-between border-b border-slate-200 px-4 py-4">
		<div>
			<p class="text-[10px] font-semibold tracking-[0.18em] text-outline uppercase">Navegación</p>
			<p class="text-sm font-semibold text-brand-navy">Accesos rápidos</p>
		</div>
		<button
			type="button"
			onclick={onClose}
			class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-navy"
			aria-label="Cerrar menú"
		>
			<X class="h-4 w-4" />
		</button>
	</div>

	<nav class="flex-1 overflow-y-auto py-3">
		{@render navigation(onClose, false)}
	</nav>
</aside>
