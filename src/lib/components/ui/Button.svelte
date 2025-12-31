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

	const variantClasses = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		ghost: 'btn-ghost',
		danger: 'btn-danger'
	};

	const sizeClasses = {
		sm: 'px-3 py-1.5 text-sm',
		md: 'px-4 py-2',
		lg: 'px-6 py-3 text-lg'
	};
</script>

<button
	class="{variantClasses[variant]} {sizeClasses[size]} {className}"
	disabled={disabled || loading}
	{...restProps}
>
	{#if loading}
		<span class="spinner"></span>
	{/if}
	{@render children()}
</button>
