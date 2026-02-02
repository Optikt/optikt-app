<script lang="ts">
	import { setUiConfig } from '$lib/context';
	import { Sidebar } from '$lib/components/layout';

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
	<main class="min-h-screen flex-1 overflow-y-auto bg-slate-50">
		{@render children()}
	</main>
</div>
