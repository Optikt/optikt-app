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

<div class="mb-4">
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
		<!-- eslint-disable-next-line svelte/valid-compile -->
		<a
			href={resolve(backHref as '/')}
			class="mb-3 flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-brand-blue"
		>
			<ArrowLeft size={16} />
			{backLabel}
		</a>
	{/if}

	<header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div>
			{#if subtitle}
				<p class="mb-0 text-xs font-semibold tracking-widest text-slate-400 uppercase">
					{subtitle}
				</p>
			{/if}
			<h1 class="font-heading m-0 text-3xl font-bold text-brand-navy">{title}</h1>
		</div>

		{#if actions}
			<div class="flex shrink-0 items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</header>
</div>
