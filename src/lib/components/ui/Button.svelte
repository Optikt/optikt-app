<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		children: Snippet;
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		class?: string;
	}

	let {
		children,
		variant = 'primary',
		size = 'md',
		loading = false,
		class: className = '',
		disabled,
		...restProps
	}: Props = $props();

	// Base button classes - all buttons share these
	const baseClasses =
		'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed';

	// Variant-specific styles
	const variantClasses = {
		primary:
			'text-white bg-gradient-to-br from-[var(--color-brand-blue)] to-[var(--color-brand-navy)] shadow-[0_4px_14px_rgba(78,181,197,0.4)] hover:enabled:-translate-y-0.5 hover:enabled:shadow-[0_6px_20px_rgba(78,181,197,0.5)]',
		secondary:
			'text-[var(--color-brand-blue)] bg-transparent border-2 !border-[var(--color-brand-blue)] hover:enabled:text-white hover:enabled:bg-[var(--color-brand-blue)]',
		ghost: 'text-[var(--color-brand-navy)] bg-transparent hover:enabled:bg-black/5',
		danger:
			'text-white bg-gradient-to-br from-red-500 to-red-600 shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:enabled:-translate-y-0.5 hover:enabled:shadow-[0_6px_20px_rgba(239,68,68,0.4)]'
	};

	const sizeClasses = {
		sm: 'px-3 py-1.5 text-sm',
		md: 'px-4 py-2.5',
		lg: 'px-6 py-3 text-lg'
	};
</script>

<button
	class="{baseClasses} {variantClasses[variant]} {sizeClasses[size]} {className}"
	disabled={disabled || loading}
	{...restProps}
>
	{#if loading}
		<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
	{/if}
	{@render children()}
</button>
