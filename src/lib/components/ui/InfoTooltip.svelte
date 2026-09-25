<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import { Info } from '@lucide/svelte';

	interface Props {
		text: string;
		side?: 'top' | 'right' | 'bottom' | 'left';
		class?: string;
	}

	let { text, side = 'top', class: className = '' }: Props = $props();
</script>

<Tooltip.Provider delayDuration={150}>
	<Tooltip.Root>
		<Tooltip.Trigger
			type="button"
			onclick={(event) => event.preventDefault()}
			class={`inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-outline transition-colors hover:text-brand-blue focus:outline-none ${className}`}
			aria-label="Más información"
		>
			<Info size={12} />
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content
				{side}
				sideOffset={6}
				class="z-[70] max-w-64 rounded-lg bg-brand-navy px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
			>
				{text}
				<Tooltip.Arrow class="fill-brand-navy" />
			</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>
