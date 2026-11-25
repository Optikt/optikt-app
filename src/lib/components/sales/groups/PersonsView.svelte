<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { ChevronDown, Sparkles } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import {
		groupCode,
		groupDisplayLabel,
		isGroupableItemType,
		orderGroupMembers,
		remainingQty,
		type ItemGroup
	} from '$lib/shared/saleItemGroups';
	import { SaleItemType } from '$lib/shared/enums/lensTypes';
	import { hasPrescriptionSnapshot } from '$lib/shared/prescriptionSnapshot';
	import { rxRowLine } from '$lib/components/commercialDocument/itemView';
	import { ITEM_KIND_ICONS } from '$lib/components/commercialDocument/tones';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import {
		itemKind,
		itemKindTooltip,
		itemLabel,
		itemSubtitle,
		type DisplayGroup
	} from '../itemsTable/itemDisplay';
	import LensRxPanel from '../itemsTable/LensRxPanel.svelte';
	import { treatmentChildDisplay } from '../editSaleDraft';
	import PersonAvatar from './PersonAvatar.svelte';
	import { groupLensIds, groupUnits, personColor, type GroupItemView } from './groupsState';

	/**
	 * "Por persona" view of the detail (sale & quote): full visual parity with
	 * `SaleItemsRow` (kind icons, links, subtitles, expandable Rx, treatments)
	 * without money columns (a split line is never split in money).
	 */
	interface Props {
		displayGroups: DisplayGroup[];
		items: GroupItemView[];
		groups: ItemGroup[];
		primaryLensItemId?: string | null;
		docLabel?: string;
	}

	let { displayGroups, items, groups, primaryLensItemId = null, docLabel }: Props = $props();

	const expanded = new SvelteMap<string, boolean>();
	const byId = $derived(new Map(displayGroups.map((dg) => [dg.item.id, dg])));

	const unassigned = $derived(
		items
			.filter((i) => isGroupableItemType(i.itemType))
			.map((i) => ({ view: i, dg: byId.get(i.id), free: remainingQty(i, groups) }))
			.filter(
				(u): u is { view: GroupItemView; dg: DisplayGroup; free: number } => !!u.dg && u.free > 0
			)
	);
	const unassignedUnits = $derived(unassigned.reduce((sum, u) => sum + u.free, 0));

	function toggle(key: string) {
		expanded.set(key, !expanded.get(key));
	}

	function rxLines(dg: DisplayGroup): { od: string; oi: string } | null {
		const { item } = dg;
		if (item.itemType !== SaleItemType.LENS_PAIR || !hasPrescriptionSnapshot(item)) return null;
		const od = {
			sphere: item.odSphere,
			cylinder: item.odCylinder,
			axis: item.odAxis,
			addition: item.odAddition
		};
		const os = {
			sphere: item.osSphere,
			cylinder: item.osCylinder,
			axis: item.osAxis,
			addition: item.osAddition
		};
		const empty = (e: typeof od) => Object.values(e).every((v) => v == null);
		return {
			od: rxRowLine('OD', empty(od), od),
			oi: rxRowLine('OI', empty(os), os)
		};
	}

	function handleRowClick(event: MouseEvent, key: string, isLens: boolean) {
		if (!isLens) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('a, button')) return;
		toggle(key);
	}
</script>

{#snippet personItemRow(
	dg: DisplayGroup,
	rowKey: string,
	qtyText: string,
	isSplit: boolean,
	showPrimaryBadge: boolean
)}
	{@const item = dg.item}
	{@const kind = itemKind(item.itemType)}
	{@const KindIcon = ITEM_KIND_ICONS[kind].icon}
	{@const isLens = item.itemType === SaleItemType.LENS_PAIR}
	{@const rx = rxLines(dg)}
	{@const isOpen = expanded.get(rowKey) ?? false}
	{@const title = itemLabel(dg)}
	{@const subtitle = itemSubtitle(dg)}
	{@const visibleTreatments = dg.treatments.filter(
		(t) => treatmentChildDisplay(t).perEyeSalePrice > 0
	)}

	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		onclick={(e) => handleRowClick(e, rowKey, isLens)}
		class="grid grid-cols-[32px_minmax(0,1fr)_auto_26px] items-start gap-3 border-t border-outline-variant/60 px-4 py-2.5 transition-colors duration-150 hover:bg-[#f6f8fb] {isLens
			? 'cursor-pointer'
			: ''}"
	>
		{#snippet chipTrigger({ props }: { props: Record<string, unknown> })}
			<span
				{...props}
				class="grid h-[32px] w-[32px] shrink-0 cursor-help place-items-center rounded-lg {ITEM_KIND_ICONS[
					kind
				].chipClass}"
			>
				<KindIcon class="h-4 w-4" />
			</span>
		{/snippet}
		<TriggerTooltip trigger={chipTrigger} text={itemKindTooltip(kind)} />

		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
				{#if item.itemType === SaleItemType.LENS_PAIR && item.lensCatalogItem}
					<a
						href={resolve(`/lenses/${item.lensCatalogItem.id}`)}
						onclick={(e) => e.stopPropagation()}
						class="text-sm font-semibold text-on-surface transition-colors hover:text-on-info-container hover:underline hover:underline-offset-2"
						>{title}</a
					>
				{:else if item.itemType === SaleItemType.PRODUCT && item.product}
					<a
						href={resolve(`/products/${item.product.id}`)}
						onclick={(e) => e.stopPropagation()}
						class="text-sm font-semibold text-on-surface transition-colors hover:text-on-info-container hover:underline hover:underline-offset-2"
						>{title}</a
					>
				{:else}
					<span class="text-sm font-semibold text-on-surface">{title}</span>
				{/if}
				{#if showPrimaryBadge}
					<span
						class="rounded bg-[#fff4c2] px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.06em] text-[#6f5900]"
						>★ FÓRMULA DEL CLIENTE</span
					>
				{/if}
			</div>

			{#if subtitle}
				<p class="mt-0.5 truncate text-xs text-on-surface-variant">{subtitle}</p>
			{/if}

			{#if rx && !isOpen}
				<div class="mt-1 space-y-0.5 text-xs text-on-surface">
					<p class="font-medium">{rx.od}</p>
					<p class="font-medium">{rx.oi}</p>
				</div>
			{/if}
		</div>

		<div class="pt-0.5 text-right">
			<span
				class="inline-block rounded px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums {isSplit
					? 'bg-[#e3eefb] text-[#16357f]'
					: 'bg-surface-container-high text-on-surface-variant'}"
			>
				{qtyText}
			</span>
		</div>

		<div class="flex justify-end pt-0.5">
			{#if isLens}
				<button
					type="button"
					aria-label={isOpen ? 'Ocultar la fórmula completa' : 'Ver la fórmula completa'}
					aria-expanded={isOpen}
					onclick={() => toggle(rowKey)}
					class="grid h-[26px] w-[26px] place-items-center rounded-md text-on-surface-variant transition-[transform,background-color] duration-[250ms] ease-out hover:bg-surface-container-high {isOpen
						? 'rotate-180'
						: ''}"
				>
					<ChevronDown class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>

	{#if rx}
		<div
			class="grid transition-[grid-template-rows] duration-300 ease-out {isOpen
				? 'grid-rows-[1fr]'
				: 'grid-rows-[0fr]'}"
		>
			<div class="overflow-hidden">
				<LensRxPanel {item} />
			</div>
		</div>
	{/if}

	{#each visibleTreatments as treatment (treatment.id)}
		{@const display = treatmentChildDisplay(treatment)}
		{@const isAr = treatment.snapshotTreatmentCategory?.toUpperCase() === 'AR'}
		<div
			class="flex items-center gap-2 border-t border-outline-variant/40 bg-surface-container-lowest py-1.5 pr-4 pl-12 text-xs text-on-surface-variant"
		>
			<Sparkles class="h-3.5 w-3.5 shrink-0 text-purple-600" />
			<span class="min-w-0 flex-1 truncate font-medium text-on-surface">
				{treatment.snapshotName ?? 'Tratamiento'}
			</span>
			<span
				class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {isAr
					? 'bg-brand-blue/10 text-brand-blue'
					: 'bg-surface-container-high text-on-surface-variant'}"
			>
				{isAr ? 'Antirreflejo' : 'Adicional'}
			</span>
			<span class="font-mono text-[11px] tabular-nums">×{display.eyes}</span>
		</div>
	{/each}
{/snippet}

<div class="flex flex-col">
	{#each groups as group, index (index)}
		{@const color = personColor(index)}
		{@const code = groupCode(docLabel, index)}
		{@const groupLenses = groupLensIds(group, items)}
		{@const hasPrimary = group.members.some((m) => m.itemId === primaryLensItemId)}
		{@const orderedMembers = orderGroupMembers(group.members, items)}
		<div class="border-t border-outline-variant/60">
			<div
				class="flex flex-wrap items-center gap-2.5 border-l-[3px] px-4 py-2.5"
				style:background-color={color.bg}
				style:border-left-color={color.dot}
			>
				<PersonAvatar label={group.label} {index} />
				{#if code}
					<span
						class="rounded-md bg-white px-2 py-0.5 font-mono text-[13px] font-bold shadow-xs"
						style:color={color.fg}
					>
						{code}
					</span>
				{/if}
				<b class="text-[15px]" style:color={color.fg}>{groupDisplayLabel(group.label, index)}</b>
				<span class="text-[13px] font-medium text-on-surface-variant">
					· {groupUnits(group)}
					{groupUnits(group) === 1 ? 'ítem' : 'ítems'}
				</span>
				{#if hasPrimary && groupLenses.length === 1}
					<span
						class="rounded bg-[#fff4c2] px-2 py-0.5 text-[11px] font-bold tracking-[0.05em] text-[#6f5900]"
						>★ FÓRMULA DEL CLIENTE</span
					>
				{/if}
			</div>

			{#each orderedMembers as member (member.itemId)}
				{@const dg = byId.get(member.itemId)}
				{#if dg}
					{@const isSplit = member.quantity < dg.quantity}
					{@render personItemRow(
						dg,
						`g-${index}-${member.itemId}`,
						isSplit ? `${member.quantity} de ${dg.quantity}` : `×${member.quantity}`,
						isSplit,
						groupLenses.length > 1 && primaryLensItemId === member.itemId
					)}
				{/if}
			{/each}
		</div>
	{/each}

	{#if unassigned.length > 0}
		<div class="border-t border-dashed border-outline-variant">
			<div class="flex items-center gap-2 bg-surface-container-low px-4 py-2 text-xs">
				<b class="text-on-surface-variant">Sin asignar</b>
				<span class="text-on-surface-variant">
					· {unassignedUnits}
					{unassignedUnits === 1 ? 'ítem' : 'ítems'}
				</span>
			</div>
			{#each unassigned as entry (entry.view.id)}
				{@const isSplit = entry.free < entry.dg.quantity}
				{@render personItemRow(
					entry.dg,
					`u-${entry.view.id}`,
					isSplit ? `${entry.free} de ${entry.dg.quantity}` : `×${entry.free}`,
					isSplit,
					primaryLensItemId === entry.view.id
				)}
			{/each}
		</div>
	{/if}

	<p class="border-t border-outline-variant/60 px-4 py-2 text-[11px] text-on-surface-variant">
		Montos solo en la vista Lista: una línea repartida no se divide en dinero.
	</p>
</div>
