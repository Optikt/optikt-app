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
		glass:
			'bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)]',
		dark: 'bg-slate-800/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-white'
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
