<script lang="ts">
	import { page } from '$app/state';
	import type { Component } from 'svelte';
	import type { ResolvedPathname } from '$app/types';

	let {
		href,
		label,
		icon: Icon,
		badge,
		badgeDisplay = 'text',
		matchSubPaths = false,
		onSelect
	}: {
		href: ResolvedPathname;
		label: string;
		icon: Component;
		badge?: string;
		badgeDisplay?: 'text' | 'dot';
		matchSubPaths?: boolean;
		onSelect?: () => void;
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
	onclick={onSelect}
	class={[
		'mx-2 my-0.5 flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 no-underline transition-all duration-150 hover:bg-slate-50',
		isActive
			? 'bg-brand-blue/10 font-medium text-brand-blue'
			: 'text-slate-600 hover:text-slate-800'
	]}
>
	<span class="flex min-w-0 items-center gap-3">
		<Icon size={20} />
		<span class="truncate">{label}</span>
	</span>

	{#if badge}
		{#if badgeDisplay === 'dot'}
			<span class="flex shrink-0 items-center">
				<span class="sr-only">{badge}</span>
				<span aria-hidden="true" class="h-2 w-2 rounded-full bg-brand-gold"></span>
			</span>
		{:else}
			<span
				class={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] uppercase ${
					isActive ? 'bg-brand-blue/15 text-brand-blue' : 'bg-brand-gold/20 text-brand-navy'
				}`}
			>
				{badge}
			</span>
		{/if}
	{/if}
</a>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
