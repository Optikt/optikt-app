<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	type Size = 'md' | 'lg';

	let {
		open = $bindable(false),
		onclose,
		title,
		subtitle,
		size = 'lg' as Size,
		children
	}: {
		open?: boolean;
		onclose?: () => void;
		title?: string;
		subtitle?: string;
		size?: Size;
		children: Snippet;
	} = $props();

	const maxWidth = {
		md: 'max-w-md',
		lg: 'max-w-lg'
	} as const;

	function handleClose() {
		open = false;
		onclose?.();
	}
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && open) handleClose(); }} />

<div
	class="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out"
	class:opacity-0={!open}
	class:pointer-events-none={!open}
	onclick={handleClose}
	role="presentation"
></div>

<div
	class="fixed right-0 top-0 z-50 flex h-full w-full {maxWidth[size]} flex-col bg-surface-container-lowest shadow-2xl transition-transform duration-300 ease-in-out"
	class:translate-x-full={!open}
	class:translate-x-0={open}
	role="dialog"
	aria-modal="true"
	aria-label={title}
>
	{#if title}
		<div class="flex items-start justify-between gap-3 border-b border-outline-variant/20 px-6 py-4">
			<div class="min-w-0">
				{#if subtitle}
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">{subtitle}</p>
				{/if}
				<h2 class="truncate text-sm font-bold text-on-surface">{title}</h2>
			</div>
			<button
				type="button"
				onclick={handleClose}
				class="shrink-0 cursor-pointer rounded-md p-1.5 text-outline transition-colors hover:bg-surface-container-low hover:text-on-surface-variant"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto px-6 py-4">
		{@render children()}
	</div>
</div>
