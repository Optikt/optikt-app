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
		default: 'bg-white border border-slate-200 shadow-sm rounded-xl',
		glass: 'glass-card',
		dark: 'glass-card-dark'
	};

	const paddingClasses = {
		none: '',
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8'
	};
</script>

<div class="{variantClasses[variant]} {paddingClasses[padding]} {className}">
	{@render children()}
</div>
