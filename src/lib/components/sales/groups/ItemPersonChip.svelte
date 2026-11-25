<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { mergeProps } from 'bits-ui';
	import PopoverRoot from '$lib/components/ui/popover/popover.svelte';
	import PopoverTrigger from '$lib/components/ui/popover/popover-trigger.svelte';
	import PopoverContent from '$lib/components/ui/popover/popover-content.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { chipModel, groupCode } from '$lib/shared/saleItemGroups';
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
		docLabel?: string;
		touch?: boolean;
	}

	let {
		item,
		groups,
		onchange,
		onorganize,
		onclose,
		caption = true,
		docLabel,
		touch = false
	}: Props = $props();

	let open = $state(false);

	const chip = $derived(chipModel(item, groups));
	const color = $derived(chip.state === 'single' ? personColor(chip.shares[0].groupIndex) : null);
	const singleCode = $derived(
		chip.state === 'single' ? groupCode(docLabel, chip.shares[0].groupIndex) : null
	);
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
		<span class="text-[11px] font-bold tracking-[0.08em] text-on-surface-variant">PARA</span>
	{/if}
	<PopoverRoot bind:open onOpenChange={handleOpenChange}>
		<PopoverTrigger>
			{#snippet child({ props: popoverProps })}
				{#snippet chipButton({ props: tooltipProps }: { props: Record<string, unknown> })}
					<button
						{...mergeProps(popoverProps, tooltipProps)}
						type="button"
						aria-label="Para quién es: {chip.text}"
						class="inline-flex items-center gap-1.5 rounded-full border text-[13px] font-semibold transition-colors {touch
							? 'h-11 px-3'
							: 'min-h-7 py-0.5 pr-2.5 pl-1'} {chip.state === 'none'
							? 'border-dashed border-outline bg-white pl-2.5 text-on-surface-variant hover:bg-surface-container-low'
							: chip.state === 'multi'
								? 'border-[#c9dcf3] bg-[#e3eefb] pl-2.5 text-[#16357f]'
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
							{#if singleCode}
								<span
									class="rounded bg-white/85 px-1.5 py-0.5 font-mono text-xs font-bold tracking-tight"
									style:color={color?.fg}
								>
									{singleCode}
								</span>
							{/if}
						{/if}
						<span class="max-w-44 truncate font-bold">{chip.text}</span>
						<ChevronDown class="h-3.5 w-3.5" />
					</button>
				{/snippet}
				{#if tooltipItems.length > 0}
					<TriggerTooltip title="Reparto" items={tooltipItems} trigger={chipButton} />
				{:else}
					{@render chipButton({ props: {} })}
				{/if}
			{/snippet}
		</PopoverTrigger>
		<PopoverContent align="start" sideOffset={6} class="z-60 w-[340px] bg-white p-2.5 shadow-lg">
			<ItemPersonPopover
				{item}
				{groups}
				{onchange}
				{docLabel}
				{touch}
				onorganize={onorganize ? organize : undefined}
			/>
		</PopoverContent>
	</PopoverRoot>
</span>
