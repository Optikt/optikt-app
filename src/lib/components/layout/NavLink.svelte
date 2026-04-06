<script lang="ts">
	import { page } from '$app/state';
	import type { Component } from 'svelte';
	import type { ResolvedPathname } from '$app/types';

	let {
		href,
		label,
		icon: Icon,
		matchSubPaths = false
	}: {
		href: ResolvedPathname;
		label: string;
		icon: Component;
		matchSubPaths?: boolean;
	} = $props();

	const isActive = $derived(
		matchSubPaths
			? page.url.pathname === href || page.url.pathname.startsWith(href + '/')
			: page.url.pathname === href
	);
</script>

<!-- disable rule here since we already resolved the path name after passing it -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<a
	title={label}
	{href}
	class={[
		'mx-2 my-0.5 flex items-center gap-3 rounded-lg px-4 py-2.5 no-underline transition-all duration-150 hover:bg-slate-50',
		isActive
			? 'bg-brand-blue/10 font-medium text-brand-blue'
			: 'text-slate-600 hover:text-slate-800'
	]}
>
	<Icon size={20} />
	<span>{label}</span>
</a>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
