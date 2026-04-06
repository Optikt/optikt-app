<script lang="ts">
	import { setUiConfig } from '$lib/context';
	import { AppNavbar, Sidebar } from '$lib/components/layout';

	let { children, data } = $props();

	const user = $derived(data.user);

	// Provide UI config via type-safe context
	setUiConfig({
		sidebarCollapsed: () => data.sidebarCollapsed
	});
</script>

<div class="flex min-h-screen flex-col">
	<!-- Full-width top navbar -->
	<AppNavbar {user} />

	<!-- Sidebar + Content below navbar -->
	<div class="flex flex-1">
		<Sidebar {user} />

		<main class="flex-1 overflow-y-auto bg-surface">
			{@render children()}
		</main>
	</div>
</div>
