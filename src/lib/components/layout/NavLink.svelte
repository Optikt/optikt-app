<script lang="ts">
	import { page } from '$app/state';
	import type { Component } from 'svelte';
	import type { ResolvedPathname } from '$app/types';

	let {
		href,
		label,
		icon: Icon,
		collapsed = false,
		matchSubPaths = false
	}: {
		href: ResolvedPathname;
		label: string;
		icon: Component;
		collapsed?: boolean;
		matchSubPaths?: boolean;
	} = $props();

	const isActive = $derived(
		matchSubPaths
			? page.url.pathname === href || page.url.pathname.startsWith(href + '/')
			: page.url.pathname === href
	);
</script>

<a
	title={label}
	{href}
	class={[
		'mx-3 my-1 flex items-center gap-3 rounded-lg px-4 py-3 no-underline transition-all duration-200 hover:bg-white/10 hover:text-white',
		isActive ? 'bg-brand-blue/20 text-brand-blue' : 'text-slate-400'
	]}
>
	<Icon size={20} />
	{#if !collapsed}
		<span>{label}</span>
	{/if}
</a>
