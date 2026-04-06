<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Component } from 'svelte';

	let {
		label,
		href,
		icon: Icon
	}: {
		label: string;
		href: string;
		icon: Component;
	} = $props();
</script>

<a
	href={resolve(href)}
	class="flex flex-col items-center gap-2.5 rounded-xl bg-white/10 p-4 no-underline transition-all duration-150 hover:bg-white/20"
>
	<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
		<Icon size={20} class="text-brand-gold" />
	</div>
	<span class="text-[0.65rem] font-semibold tracking-wider text-white/90 uppercase">{label}</span>
</a>
