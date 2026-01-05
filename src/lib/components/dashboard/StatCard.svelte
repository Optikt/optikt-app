<script lang="ts">
	import type { Component } from 'svelte';

	let {
		label,
		value,
		icon: Icon,
		color
	}: {
		label: string;
		value: string;
		icon: Component;
		color: 'blue' | 'green' | 'purple' | 'orange';
	} = $props();

	const colorMap = {
		blue: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
		green: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
		purple: 'bg-gradient-to-br from-violet-500 to-violet-600 text-white',
		orange: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white'
	};
</script>

<div class="glass-card flex items-center gap-4 p-6">
	<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl {colorMap[color]}">
		<Icon size={24} />
	</div>
	<div class="flex flex-col">
		<span class="text-[1.75rem] font-bold text-brand-navy">{value}</span>
		<span class="text-sm text-slate-500">{label}</span>
	</div>
</div>
