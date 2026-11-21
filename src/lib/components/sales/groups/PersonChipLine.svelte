<script lang="ts">
	import ItemPersonChip from './ItemPersonChip.svelte';
	import type { GroupItemView, UiGroup } from './groupsState';

	/** Chip "PARA …" + the "★ Fórmula del cliente" badge (wizard and edit drawer). */
	interface Props {
		item: GroupItemView;
		groups: UiGroup[];
		onchange: (groups: UiGroup[]) => void;
		onorganize?: () => void;
		onclose?: () => void;
		isPrimary?: boolean;
	}

	let { item, groups, onchange, onorganize, onclose, isPrimary = false }: Props = $props();
</script>

<span class="inline-flex flex-wrap items-center gap-1.5">
	<ItemPersonChip {item} {groups} {onchange} {onorganize} {onclose} />
	{#if isPrimary}
		<span
			class="rounded bg-[#fff4c2] px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.06em] text-[#6f5900] uppercase"
			>★ Fórmula del cliente</span
		>
	{/if}
</span>
