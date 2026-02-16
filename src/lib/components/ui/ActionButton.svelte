<script lang="ts">
	import type { Component } from 'svelte';

	interface Props {
		icon: Component<{ class?: string }>;
		title: string;
		color?: 'default' | 'blue' | 'red' | 'amber' | 'green';
		onclick?: () => void;
		href?: string;
		hidden?: boolean;
	}

	let { icon: Icon, title, color = 'default', onclick, href, hidden = false }: Props = $props();

	const colorClasses: Record<string, string> = {
		default: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
		blue: 'text-slate-500 hover:bg-blue-50 hover:text-blue-600',
		red: 'text-slate-500 hover:bg-red-50 hover:text-red-600',
		amber: 'text-slate-500 hover:bg-amber-50 hover:text-amber-600',
		green: 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
	};

	const baseClasses =
		'flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150';
</script>

{#if !hidden}
	{#if href}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a {href} class="{baseClasses} {colorClasses[color]}" {title}>
			<Icon class="h-4 w-4" />
		</a>
	{:else}
		<button type="button" {onclick} class="{baseClasses} {colorClasses[color]}" {title}>
			<Icon class="h-4 w-4" />
		</button>
	{/if}
{/if}
