<script lang="ts">
	import { Sidebar } from '$lib/components/layout';

	let { children, data } = $props();

	const user = $derived(data.user);
</script>

<div class="flex min-h-screen">
	<Sidebar {user} />

	<!-- Main content -->
	<main class="min-h-screen flex-1 overflow-y-auto bg-slate-50">
		{@render children()}
	</main>
</div>
