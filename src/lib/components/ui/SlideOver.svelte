<script lang="ts">
	import type { Snippet } from 'svelte';

	type Size = 'md' | 'lg' | 'xl';

	let {
		open = $bindable(false),
		onclose,
		size = 'lg' as Size,
		children,
		header,
		footer
	}: {
		open?: boolean;
		onclose?: () => void;
		size?: Size;
		children: Snippet;
		header?: Snippet<[{ onclose: () => void }]>;
		footer?: Snippet;
	} = $props();

	const maxWidth = {
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-2xl'
	} as const;

	let panel: HTMLDivElement | undefined = $state();

	function handleClose() {
		open = false;
		onclose?.();
	}

	$effect(() => {
		if (!open) return;
		panel?.focus();

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') handleClose();
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});
</script>

<div
	class="fixed inset-0 z-54 bg-black/50 transition-opacity duration-300 ease-in-out"
	class:opacity-0={!open}
	class:pointer-events-none={!open}
	role="presentation"
></div>

<div
	bind:this={panel}
	class="fixed top-0 right-0 z-55 flex h-full w-full {maxWidth[
		size
	]} flex-col bg-surface-container-lowest shadow-2xl transition-transform duration-300 ease-in-out outline-none"
	class:translate-x-full={!open}
	class:translate-x-0={open}
	role="dialog"
	aria-modal="true"
	tabindex="-1"
>
	{#if header}
		{@render header({ onclose: handleClose })}
	{/if}

	<div class="flex-1 overflow-y-auto px-6 py-4">
		{@render children()}
	</div>

	{#if footer}
		{@render footer()}
	{/if}
</div>
