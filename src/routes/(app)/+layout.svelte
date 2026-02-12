<script lang="ts">
	import { setUiConfig } from '$lib/context';
	import { Sidebar, CommandSearch } from '$lib/components/layout';

	let { children, data } = $props();

	const user = $derived(data.user);

	// Provide UI config via type-safe context
	setUiConfig({
		sidebarCollapsed: () => data.sidebarCollapsed
	});
</script>

<div class="flex min-h-screen">
	<Sidebar {user} />

	<!-- Main content -->
	<div class="flex min-h-screen flex-1 flex-col overflow-y-auto bg-slate-50">
		<!-- Global search bar -->
		<header
			class="sticky top-0 z-40 flex items-center gap-4 border-b border-slate-200 bg-white/80 px-8 py-3 backdrop-blur-sm"
		>
			<CommandSearch />
		</header>

		<main class="flex-1">
			{@render children()}
		</main>
	</div>
</div>
