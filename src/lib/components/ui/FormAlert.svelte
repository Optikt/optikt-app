<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		message?: string;
		class?: string;
	}

	let { children, message, class: className = '' }: Props = $props();
</script>

{#if message}
	<div
		class="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-600 {className}"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="flex-shrink-0"
		>
			<circle cx="12" cy="12" r="10"></circle>
			<line x1="12" y1="8" x2="12" y2="12"></line>
			<line x1="12" y1="16" x2="12.01" y2="16"></line>
		</svg>
		<span>{message}</span>
	</div>
{/if}

{@render children()}
