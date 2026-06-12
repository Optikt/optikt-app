<script lang="ts">
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { fade } from 'svelte/transition';
	import { setInventoryCountContext, setUiConfig, type InventoryCountContext } from '$lib/context';
	import { AppNavbar, Sidebar } from '$lib/components/layout';
	import { initExchangeRatesPolling } from '$lib/stores/exchangeRates.svelte';

	let { children, data } = $props();

	const user = $derived(data.user);
	const initialActiveInventoryCountSession = untrack(() => {
		const layoutData = data as typeof data & {
			activeInventoryCountSession?: { id: number } | null;
		};

		return layoutData.activeInventoryCountSession
			? { id: layoutData.activeInventoryCountSession.id }
			: null;
	});
	let inventoryCountContext = $state<InventoryCountContext>({
		activeSession: initialActiveInventoryCountSession
	});
	let mobileNavOpen = $state(false);
	let sidebarCollapsed = $state(untrack(() => data.sidebarCollapsed));

	// Provide UI config via type-safe context
	setUiConfig({
		sidebarCollapsed: () => sidebarCollapsed
	});
	setInventoryCountContext(inventoryCountContext);

	$effect(() => initExchangeRatesPolling());

	let mainEl = $state<HTMLElement>();
	const scrollPositions = new SvelteMap<string, number>();

	function getUrlKey(url: URL): string {
		return `${url.pathname}${url.search}`;
	}

	function toggleSidebarCollapsed() {
		sidebarCollapsed = !sidebarCollapsed;
		document.cookie = `sidebar.collapsed=${sidebarCollapsed}; path=/; max-age=31536000; SameSite=Lax`;
	}

	beforeNavigate(() => {
		if (!mainEl) return;
		scrollPositions.set(getUrlKey(page.url), mainEl.scrollTop);
	});

	afterNavigate((navigation) => {
		mobileNavOpen = false;

		if (!mainEl || !navigation.to) return;

		if (navigation.type === 'popstate') {
			const savedTop = scrollPositions.get(getUrlKey(navigation.to.url));
			mainEl.scrollTo(0, savedTop ?? 0);
			return;
		}

		mainEl?.scrollTo(0, 0);
	});
</script>

<div class="flex h-screen flex-col overflow-hidden">
	<!-- Full-width top navbar -->
	<AppNavbar
		{user}
		{mobileNavOpen}
		{sidebarCollapsed}
		onToggleNav={() => {
			mobileNavOpen = !mobileNavOpen;
		}}
		onToggleSidebar={toggleSidebarCollapsed}
	/>

	<!-- Sidebar + Content below navbar -->
	<div class="flex min-h-0 flex-1">
		<Sidebar
			{user}
			mobileOpen={mobileNavOpen}
			collapsed={sidebarCollapsed}
			onClose={() => (mobileNavOpen = false)}
		/>

		<main bind:this={mainEl} class="flex-1 overflow-y-auto bg-surface">
			{#key page.url.pathname}
				<div in:fade={{ duration: 200 }}>
					{@render children()}
				</div>
			{/key}
		</main>
	</div>
</div>
