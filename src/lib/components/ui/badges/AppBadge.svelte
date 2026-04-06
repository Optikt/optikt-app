<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BadgeVariant } from '$lib/shared/badge-variants';

	interface Props {
		variant?: BadgeVariant;
		class?: string;
		children: Snippet;
	}

	let { variant = 'neutral', class: className = '', children }: Props = $props();

	const variantClasses: Record<BadgeVariant, string> = {
		success: 'bg-success-container text-on-success-container',
		warning: 'bg-warning-container text-on-warning-container',
		error: 'bg-error-container text-on-error-container',
		neutral: 'bg-surface-container-high text-on-surface-variant',
		info: 'bg-info-container text-on-info-container',
		purple: 'bg-purple-container text-on-purple-container'
	};
</script>

<span
	class="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase {variantClasses[
		variant
	]} {className}"
>
	{@render children()}
</span>
