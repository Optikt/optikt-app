<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Component } from 'svelte';
	import type { StaticRoute } from '$lib/shared/routes';

	let {
		href,
		label,
		icon: Icon,
		badge,
		badgeDisplay = 'text',
		matchSubPaths = false,
		collapsed = false,
		onSelect
	}: {
		href: StaticRoute;
		label: string;
		icon: Component;
		badge?: string;
		badgeDisplay?: 'text' | 'dot';
		matchSubPaths?: boolean;
		collapsed?: boolean;
		onSelect?: () => void;
	} = $props();

	const isActive = $derived(
		matchSubPaths
			? page.url.pathname === href || page.url.pathname.startsWith(href + '/')
			: page.url.pathname === href
	);
</script>

<a
	title={label}
	href={resolve(href)}
	onclick={onSelect}
	class={[
		'relative mx-2 my-0.5 flex items-center rounded-lg py-2.5 no-underline transition-colors duration-150',
		collapsed ? 'justify-center px-2' : 'justify-between gap-3 px-4',
		isActive
			? 'bg-brand-blue/10 font-medium text-brand-blue'
			: 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
	]}
>
	{#if isActive && collapsed}
		<span
			class="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-blue"
			aria-hidden="true"
		></span>
	{/if}
	<span class={['flex min-w-0 items-center', collapsed ? 'justify-center' : 'gap-3']}>
		<Icon size={collapsed ? 22 : 20} class="shrink-0" />
		{#if !collapsed}
			<span class="truncate">{label}</span>
		{/if}
	</span>

	{#if badge}
		{#if badgeDisplay === 'dot' || collapsed}
			<span class="flex shrink-0 items-center">
				<span class="sr-only">{badge}</span>
				<span
					aria-hidden="true"
					class={[
						'h-2 w-2 rounded-full bg-brand-gold',
						collapsed ? 'absolute top-1.5 right-1.5' : ''
					]}
				></span>
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
