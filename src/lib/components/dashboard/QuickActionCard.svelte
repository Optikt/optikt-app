<script lang="ts">
	import type { Component } from 'svelte';
	import type { ResolvedPathname } from '$app/types';

	let {
		label,
		href,
		icon: Icon
	}: {
		label: string;
		href: ResolvedPathname;
		icon: Component;
	} = $props();
</script>

<!-- disable rule here since we already resolved the path name after passing it -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<a
	{href}
	class="flex min-h-[5.25rem] flex-col items-center justify-center gap-2.5 rounded-xl bg-white/10 p-4 no-underline transition-all duration-150 hover:bg-white/20"
>
	<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
		<Icon size={20} class="text-brand-gold" />
	</div>
	<span class="text-[0.65rem] font-semibold tracking-wider text-white/90 uppercase">{label}</span>
</a>
