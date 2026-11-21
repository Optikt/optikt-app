<script lang="ts">
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import { chipModel } from '$lib/shared/saleItemGroups';
	import PersonAvatar from './PersonAvatar.svelte';
	import { personColor, type GroupItemView } from './groupsState';
	import type { ItemGroup } from '$lib/shared/saleItemGroups';

	/** Read-only "para quién" line in the detail (no new column; under the description). */
	interface Props {
		item: GroupItemView;
		groups: ItemGroup[];
		isPrimary?: boolean;
	}

	let { item, groups, isPrimary = false }: Props = $props();

	let expanded = $state(false);
	const chip = $derived(chipModel(item, groups));
	const single = $derived(chip.state === 'single' && chip.free === 0);
	const color = $derived(single ? personColor(chip.shares[0].groupIndex) : null);
</script>

<div class="mt-1 flex flex-col gap-1">
	<div class="flex flex-wrap items-center gap-1.5">
		{#if chip.state === 'none'}
			<span class="text-[11.5px] text-on-surface-variant">Sin asignar</span>
		{:else if single && color}
			<span
				class="inline-flex h-[22px] items-center gap-1 rounded-full pr-2 pl-0.5 text-[11.5px] font-semibold"
				style:background-color={color.bg}
				style:color={color.fg}
			>
				<PersonAvatar
					label={groups[chip.shares[0].groupIndex]?.label}
					index={chip.shares[0].groupIndex}
					size="sm"
				/>
				{chip.shares[0].label}
			</span>
		{:else}
			<button
				type="button"
				aria-expanded={expanded}
				onclick={(e) => {
					e.stopPropagation();
					expanded = !expanded;
				}}
				class="inline-flex min-h-[22px] items-center gap-1 rounded-full border border-[#c9dcf3] bg-[#e3eefb] px-2 text-[11.5px] font-semibold text-[#16357f]"
			>
				{#if expanded}<ChevronDown class="h-3 w-3" />{:else}<ChevronRight class="h-3 w-3" />{/if}
				Para {chip.shares.length}
				{chip.shares.length === 1 ? 'persona' : 'personas'}{chip.free > 0
					? ` · ${chip.free} libre`
					: ''}
			</button>
		{/if}
		{#if isPrimary}
			<span
				class="rounded bg-[#fff4c2] px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.06em] text-[#6f5900]"
				>★ FÓRMULA DEL CLIENTE</span
			>
		{/if}
	</div>
	{#if expanded && chip.state !== 'none' && !single}
		<ul class="flex flex-col gap-0.5 border-l-2 border-[#e3eefb] pl-2 text-xs">
			{#each chip.shares as share (share.groupIndex)}
				<li class="inline-flex items-center gap-1.5">
					<span
						class="h-2 w-2 rounded-full"
						style:background-color={personColor(share.groupIndex).dot}
					></span>
					{share.quantity} × {share.label}
				</li>
			{/each}
			{#if chip.free > 0}
				<li class="inline-flex items-center gap-1.5">
					<span class="h-2 w-2 rounded-full bg-outline-variant"></span>
					{chip.free} sin asignar
				</li>
			{/if}
		</ul>
	{/if}
</div>
