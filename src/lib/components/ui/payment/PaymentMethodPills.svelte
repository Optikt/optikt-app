<script lang="ts">
	import type { Component } from 'svelte';

	interface Props {
		methods: string[];
		labels: Record<string, string>;
		selected: string | null;
		onSelect: (method: string) => void;
		icons?: Record<string, Component<{ class?: string }>>;
		class?: string;
	}

	let { methods, labels, selected, onSelect, icons, class: className = '' }: Props = $props();
</script>

<div class="flex flex-wrap gap-2 {className}">
	{#each methods as method (method)}
		<button
			type="button"
			onclick={() => onSelect(method)}
			class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 {selected ===
			method
				? 'bg-brand-navy text-white shadow-sm'
				: 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}"
			aria-pressed={selected === method}
		>
			{#if icons?.[method]}
				{@const Icon = icons[method]}
				<Icon class="h-3.5 w-3.5 shrink-0" />
			{/if}
			{labels[method] ?? method}
		</button>
	{/each}
</div>
