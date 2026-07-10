<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		open: boolean;
		ontoggle?: () => void;
		icon?: typeof ChevronRight;
		summaryValue?: string;
		statusBadge?: string;
		statusVariant?: 'error' | 'success' | 'warning';
		children: Snippet;
	}

	let {
		title,
		open = $bindable(),
		ontoggle,
		icon: Icon,
		summaryValue,
		statusBadge,
		statusVariant = 'warning',
		children
	}: Props = $props();

	function toggle() {
		open = !open;
		ontoggle?.();
	}

	const badgeClass = $derived.by(() => {
		switch (statusVariant) {
			case 'error':
				return 'bg-error-container text-on-error-container';
			case 'success':
				return 'bg-success-container text-on-success-container';
			case 'warning':
				return 'bg-warning-container text-on-warning-container';
		}
	});
</script>

<button
	type="button"
	onclick={toggle}
	class="flex w-full cursor-pointer items-center justify-between gap-2"
>
	<div class="flex items-center gap-1.5">
		{#if Icon}
			<Icon class="h-3.5 w-3.5 text-brand-blue" />
		{/if}
		<p class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">{title}</p>
	</div>
	<div class="flex items-center gap-1.5">
		{#if summaryValue}
			<span class="font-mono text-xs font-semibold text-brand-navy">{summaryValue}</span>
		{/if}
		{#if statusBadge}
			<span class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold {badgeClass}"
				>{statusBadge}</span
			>
		{/if}
		<ChevronRight
			class="h-3.5 w-3.5 text-on-surface-variant transition-transform {open ? 'rotate-90' : ''}"
		/>
	</div>
</button>
{#if open}
	<div class="mt-2 border-t border-outline-variant/30 pt-2">
		{@render children()}
	</div>
{/if}
