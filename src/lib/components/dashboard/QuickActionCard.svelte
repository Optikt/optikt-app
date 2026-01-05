<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Component } from 'svelte';

	let {
		label,
		href,
		icon: Icon,
		color
	}: {
		label: string;
		href: '/products' | '/customers' | '/sales' | '/lenses';
		icon: Component;
		color: 'blue' | 'purple' | 'green' | 'teal';
	} = $props();

	const colorMap = {
		blue: 'bg-blue-500/10 text-blue-500',
		purple: 'bg-violet-500/10 text-violet-500',
		green: 'bg-emerald-500/10 text-emerald-500',
		teal: 'bg-brand-blue/10 text-brand-blue'
	};
</script>

<a
	href={resolve(href)}
	class="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 font-medium text-brand-navy no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-[0_4px_12px_rgba(78,181,197,0.15)]"
>
	<div class="flex h-12 w-12 items-center justify-center rounded-xl {colorMap[color]}">
		<Icon size={24} />
	</div>
	<span>{label}</span>
</a>
