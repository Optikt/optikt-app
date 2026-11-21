<script lang="ts">
	import {
		groupDisplayLabel,
		isGroupableItemType,
		remainingQty,
		type ItemGroup
	} from '$lib/shared/saleItemGroups';
	import PersonAvatar from './PersonAvatar.svelte';
	import { groupUnits, personColor, type GroupItemView } from './groupsState';

	/** "Por persona" view of the detail: no amounts (a split line is never split in money). */
	interface Props {
		items: GroupItemView[];
		groups: ItemGroup[];
		/** Rx summary per lens id ("OD … · OI …"). */
		rxOf?: (itemId: string) => string | undefined;
		primaryLensItemId?: string | null;
	}

	let { items, groups, rxOf, primaryLensItemId = null }: Props = $props();

	const byId = $derived(new Map(items.map((i) => [i.id, i])));
	const unassigned = $derived(
		items
			.filter((i) => isGroupableItemType(i.itemType))
			.map((i) => ({ item: i, free: remainingQty(i, groups) }))
			.filter((u) => u.free > 0)
	);
</script>

<div class="flex flex-col">
	{#each groups as group, index (index)}
		{@const color = personColor(index)}
		{@const hasPrimary = group.members.some((m) => m.itemId === primaryLensItemId)}
		<div class="border-t border-outline-variant/60">
			<div class="flex flex-wrap items-center gap-2 px-4 py-2" style:background-color={color.bg}>
				<PersonAvatar label={group.label} {index} />
				<b class="text-[13px]" style:color={color.fg}>{groupDisplayLabel(group.label, index)}</b>
				<span class="text-xs text-on-surface-variant">
					· {groupUnits(group)}
					{groupUnits(group) === 1 ? 'ítem' : 'ítems'}
				</span>
				{#if hasPrimary}
					<span class="rounded bg-[#fff4c2] px-1.5 py-0.5 text-[9.5px] font-bold text-[#6f5900]"
						>★ FÓRMULA DEL CLIENTE</span
					>
				{/if}
			</div>
			{#each group.members as member (member.itemId)}
				{@const item = byId.get(member.itemId)}
				{#if item}
					<div
						class="flex gap-2.5 border-t border-surface-container-high py-2 pr-4 pl-12 text-[13px]"
					>
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<b class="text-brand-navy">{item.name}</b>
							{#if item.itemType === 'LENS_PAIR' && rxOf?.(item.id)}
								<span class="text-xs whitespace-pre-line">{rxOf(item.id)}</span>
							{/if}
						</div>
						<span class="font-mono text-xs text-on-surface-variant">
							{item.quantity > 1 ? `${member.quantity} de ${item.quantity}` : '×1'}
						</span>
					</div>
				{/if}
			{/each}
		</div>
	{/each}
	{#if unassigned.length > 0}
		<p
			class="border-t border-dashed border-outline-variant px-4 py-2 text-xs text-on-surface-variant"
		>
			Sin asignar: {unassigned
				.map((u) =>
					u.item.quantity > 1 ? `${u.free} de ${u.item.quantity} ${u.item.name}` : u.item.name
				)
				.join(', ')}
		</p>
	{/if}
	<p class="border-t border-outline-variant/60 px-4 py-2 text-[11px] text-on-surface-variant">
		Montos solo en la vista Lista: una línea repartida no se divide en dinero.
	</p>
</div>
