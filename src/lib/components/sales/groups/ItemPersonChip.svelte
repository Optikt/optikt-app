<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { mergeProps } from 'bits-ui';
	import PopoverRoot from '$lib/components/ui/popover/popover.svelte';
	import PopoverTrigger from '$lib/components/ui/popover/popover-trigger.svelte';
	import PopoverContent from '$lib/components/ui/popover/popover-content.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { chipModel } from '$lib/shared/saleItemGroups';
	import PersonAvatar from './PersonAvatar.svelte';
	import ItemPersonPopover from './ItemPersonPopover.svelte';
	import { personColor, type GroupItemView, type UiGroup } from './groupsState';

	interface Props {
		item: GroupItemView;
		groups: UiGroup[];
		onchange: (groups: UiGroup[]) => void;
		/** Open the Personas drawer ("Organizar todo…"). */
		onorganize?: () => void;
		/** Fired when the popover closes (the wizard reorders cards then, not while editing). */
		onclose?: () => void;
		/** Show the "PARA" caption before the chip. */
		caption?: boolean;
		touch?: boolean;
	}

	let {
		item,
		groups,
		onchange,
		onorganize,
		onclose,
		caption = true,
		touch = false
	}: Props = $props();

	let open = $state(false);

	const chip = $derived(chipModel(item, groups));
	const color = $derived(chip.state === 'single' ? personColor(chip.shares[0].groupIndex) : null);
	const tooltipItems = $derived(chip.state === 'multi' || chip.free > 0 ? chip.detail : []);

	function handleOpenChange(next: boolean) {
		if (!next) onclose?.();
	}

	function organize() {
		open = false;
		onorganize?.();
	}
</script>

<span class="inline-flex items-center gap-1.5">
	{#if caption}
		<span class="text-[10px] font-bold tracking-[0.08em] text-on-surface-variant">PARA</span>
	{/if}
	<PopoverRoot bind:open onOpenChange={handleOpenChange}>
		<PopoverTrigger>
			{#snippet child({ props: popoverProps })}
				{#snippet chipButton({ props: tooltipProps }: { props: Record<string, unknown> })}
					<button
						{...mergeProps(popoverProps, tooltipProps)}
						type="button"
						aria-label="Para quién es: {chip.text}"
						class="inline-flex items-center gap-1 rounded-full border text-xs font-semibold transition-colors {touch
							? 'h-11 px-3'
							: 'h-6 py-0 pr-2 pl-[3px]'} {chip.state === 'none'
							? 'border-dashed border-outline bg-white pl-2 text-on-surface-variant hover:bg-surface-container-low'
							: chip.state === 'multi'
								? 'border-[#c9dcf3] bg-[#e3eefb] pl-2 text-[#16357f]'
								: 'border-transparent'}"
						style:background-color={color?.bg}
						style:color={color?.fg}
					>
						{#if chip.state === 'single'}
							<PersonAvatar
								label={groups[chip.shares[0].groupIndex]?.label}
								index={chip.shares[0].groupIndex}
								size="sm"
							/>
						{/if}
						<span class="max-w-40 truncate">{chip.text}</span>
						<ChevronDown class="h-3 w-3" />
					</button>
				{/snippet}
				{#if tooltipItems.length > 0}
					<TriggerTooltip title="Reparto" items={tooltipItems} trigger={chipButton} />
				{:else}
					{@render chipButton({ props: {} })}
				{/if}
			{/snippet}
		</PopoverTrigger>
		<PopoverContent align="start" sideOffset={6} class="w-[340px] bg-white p-2.5 shadow-lg">
			<ItemPersonPopover
				{item}
				{groups}
				{onchange}
				{touch}
				onorganize={onorganize ? organize : undefined}
			/>
		</PopoverContent>
	</PopoverRoot>
</span>
