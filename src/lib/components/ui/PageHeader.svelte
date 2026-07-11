<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		backLabel?: string;
		backHref?: string;
		backOnClick?: () => void;
		actions?: Snippet;
	}

	let { title, subtitle, backLabel, backHref, backOnClick, actions }: Props = $props();
</script>

<div class="mb-2">
	{#if backLabel && backOnClick}
		<button
			type="button"
			onclick={backOnClick}
			class="mb-3 flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-brand-blue"
		>
			<ArrowLeft size={16} />
			{backLabel}
		</button>
	{:else if backLabel && backHref}
		<a
			href={resolve(backHref)}
			class="mb-3 flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-brand-blue"
		>
			<ArrowLeft size={16} />
			{backLabel}
		</a>
	{/if}

	<header class="flex flex-row items-start justify-between gap-3 sm:gap-4">
		{#if subtitle || title}
			<div>
				{#if subtitle}
					<p class="mb-0 text-xs font-semibold tracking-widest text-slate-400 uppercase">
						{subtitle}
					</p>
				{/if}
				{#if title}
					<h1 class="font-heading m-0 text-xl font-bold text-brand-navy sm:text-2xl lg:text-3xl">
						{title}
					</h1>
				{/if}
			</div>
		{/if}

		{#if actions}
			<div class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
				{@render actions()}
			</div>
		{/if}
	</header>
</div>
