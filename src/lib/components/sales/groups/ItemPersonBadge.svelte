<script lang="ts">
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import { chipModel, groupCode } from '$lib/shared/saleItemGroups';
	import PersonAvatar from './PersonAvatar.svelte';
	import { personColor, type GroupItemView } from './groupsState';
	import type { ItemGroup } from '$lib/shared/saleItemGroups';

	/** Read-only "para quién" line in the detail and wizard summary (no new column). */
	interface Props {
		item: GroupItemView;
		groups: ItemGroup[];
		isPrimary?: boolean;
		docLabel?: string;
	}

	let { item, groups, isPrimary = false, docLabel }: Props = $props();

	let expanded = $state(false);
	const chip = $derived(chipModel(item, groups));
	const single = $derived(chip.state === 'single' && chip.free === 0);
	const color = $derived(single ? personColor(chip.shares[0].groupIndex) : null);
	const singleCode = $derived(single ? groupCode(docLabel, chip.shares[0].groupIndex) : null);
</script>

<div class="mt-1.5 flex flex-col gap-1">
	<div class="flex flex-wrap items-center gap-1.5">
		{#if chip.state === 'none'}
			<span class="text-xs font-medium text-on-surface-variant">Sin asignar</span>
		{:else if single && color}
			<span
				class="inline-flex min-h-7 items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1 text-[13px] font-semibold"
				style:background-color={color.bg}
				style:color={color.fg}
			>
				<PersonAvatar
					label={groups[chip.shares[0].groupIndex]?.label}
					index={chip.shares[0].groupIndex}
					size="sm"
				/>
				{#if singleCode}
					<span
						class="rounded bg-white/85 px-1.5 py-0.5 font-mono text-xs font-bold tracking-tight"
						style:color={color.fg}
					>
						{singleCode}
					</span>
				{/if}
				<span class="font-bold">{chip.shares[0].label}</span>
			</span>
		{:else}
			<button
				type="button"
				aria-expanded={expanded}
				onclick={(e) => {
					e.stopPropagation();
					expanded = !expanded;
				}}
				class="inline-flex min-h-7 items-center gap-1 rounded-full border border-[#c9dcf3] bg-[#e3eefb] px-2.5 text-[13px] font-semibold text-[#16357f]"
			>
				{#if expanded}<ChevronDown class="h-3.5 w-3.5" />{:else}<ChevronRight
						class="h-3.5 w-3.5"
					/>{/if}
				Para {chip.shares.length}
				{chip.shares.length === 1 ? 'persona' : 'personas'}{chip.free > 0
					? ` · ${chip.free} libre`
					: ''}
			</button>
		{/if}
		{#if isPrimary}
			<span
				class="rounded bg-[#fff4c2] px-2 py-0.5 text-[11px] font-bold tracking-[0.05em] text-[#6f5900]"
			>
				★ FÓRMULA DEL CLIENTE
			</span>
		{/if}
	</div>
	{#if expanded && chip.state !== 'none' && !single}
		<ul class="flex flex-col gap-1 border-l-2 border-[#c9dcf3] pl-2.5 text-[13px]">
			{#each chip.shares as share (share.groupIndex)}
				{@const code = groupCode(docLabel, share.groupIndex)}
				<li class="inline-flex items-center gap-1.5">
					<span
						class="h-2.5 w-2.5 rounded-full"
						style:background-color={personColor(share.groupIndex).dot}
					></span>
					{#if code}
						<span
							class="rounded bg-white/90 px-1.5 py-0.5 font-mono text-xs font-bold text-brand-navy"
						>
							{code}
						</span>
					{/if}
					<span class="font-semibold">{share.quantity} × {share.label}</span>
				</li>
			{/each}
			{#if chip.free > 0}
				<li class="inline-flex items-center gap-1.5 text-on-surface-variant">
					<span class="h-2.5 w-2.5 rounded-full bg-outline-variant"></span>
					{chip.free} sin asignar
				</li>
			{/if}
		</ul>
	{/if}
</div>
