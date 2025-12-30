<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		class?: string;
		variant?: 'default' | 'glass' | 'dark';
		padding?: 'none' | 'sm' | 'md' | 'lg';
	}

	let { children, class: className = '', variant = 'default', padding = 'md' }: Props = $props();

	const variantClasses = {
		default: 'bg-white border border-slate-200 shadow-sm',
		glass: 'glass-card',
		dark: 'glass-card-dark text-white'
	};

	const paddingClasses = {
		none: '',
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8'
	};
</script>

<div class="card {variantClasses[variant]} {paddingClasses[padding]} {className}">
	{@render children()}
</div>

<style>
	.card {
		border-radius: var(--radius-card, 12px);
	}
</style>
