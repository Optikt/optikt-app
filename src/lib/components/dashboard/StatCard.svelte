<script lang="ts">
	import type { Component } from 'svelte';

	let {
		label,
		value,
		icon: Icon,
		color,
		subtitle
	}: {
		label: string;
		value: string;
		icon: Component;
		color: 'blue' | 'green' | 'purple' | 'orange';
		subtitle?: string;
	} = $props();

	const iconBg = {
		blue: 'bg-brand-blue/10 text-brand-blue',
		green: 'bg-success-container text-on-success-container',
		purple: 'bg-purple-container text-on-purple-container',
		orange: 'bg-warning-container text-on-warning-container'
	};

	const subtitleStyle = {
		blue: 'text-brand-blue',
		green: 'text-success',
		purple: 'text-success',
		orange: 'bg-error/10 text-error px-2 py-0.5 rounded-full'
	};
</script>

<div class="glass-card relative p-5">
	{#if subtitle}
		<span
			class="absolute top-4 right-4 text-[0.65rem] font-semibold uppercase {subtitleStyle[color]}"
		>
			{subtitle}
		</span>
	{/if}
	<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg {iconBg[color]}">
		<Icon size={20} />
	</div>
	<p class="font-heading text-3xl font-bold text-brand-navy">{value}</p>
	<p class="mt-0.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">{label}</p>
</div>
