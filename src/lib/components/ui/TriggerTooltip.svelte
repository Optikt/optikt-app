<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Call-to-action element (button/link). bits-ui hands you `{ props }`; spread it. */
		trigger: Snippet<[{ props: Record<string, unknown> }]>;
		title?: string;
		text?: string;
		items?: string[];
		side?: 'top' | 'right' | 'bottom' | 'left';
	}

	let { trigger, title, text, items = [], side = 'top' }: Props = $props();
</script>

<Tooltip.Provider delayDuration={150}>
	<Tooltip.Root>
		<Tooltip.Trigger child={trigger} />
		<Tooltip.Portal>
			<Tooltip.Content
				{side}
				sideOffset={6}
				class="z-[70] max-w-72 rounded-xl bg-brand-navy px-3.5 py-2.5 text-xs leading-relaxed text-white shadow-xl"
			>
				{#if title}
					<p class="font-semibold">{title}</p>
				{/if}
				{#if text}
					<p class={title ? 'mt-1' : ''}>{text}</p>
				{/if}
				{#if items.length > 0}
					<ul class={`list-disc space-y-0.5 pl-4 ${title || text ? 'mt-1' : ''}`}>
						{#each items as item (item)}
							<li>{item}</li>
						{/each}
					</ul>
				{/if}
				<Tooltip.Arrow class="fill-brand-navy" />
			</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>
