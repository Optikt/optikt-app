<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CircleAlert } from '@lucide/svelte';

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
		<CircleAlert size={20} class="shrink-0" />
		<span>{message}</span>
	</div>
{/if}

{@render children()}
