<script lang="ts">
	import SaleCard from '$lib/components/sales/SaleCard.svelte';
	import type { UserRole } from '$lib/shared/enums';
	import type { SaleListItem } from '$lib/server/db/queries/sales/types';

	interface Props {
		sales: SaleListItem[];
		canManage: boolean;
		/** 'comfortable' (Cuadros) | 'compact' (móvil Lista). */
		density?: 'comfortable' | 'compact';
		currentUserId?: string;
		currentUserRole?: UserRole;
		onOpen: (sale: SaleListItem) => void;
		onCancel: (sale: SaleListItem) => void;
		/** Móvil: ⋯ abre la hoja de acciones en vez del popover. */
		onMenu?: (sale: SaleListItem) => void;
	}

	let {
		sales,
		canManage,
		density = 'comfortable',
		currentUserId,
		currentUserRole,
		onOpen,
		onCancel,
		onMenu
	}: Props = $props();
</script>

<div
	class={density === 'compact'
		? 'flex flex-col gap-2'
		: 'grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3'}
>
	{#each sales as sale, index (sale.id)}
		<SaleCard
			{sale}
			{index}
			{density}
			{canManage}
			{currentUserId}
			{currentUserRole}
			{onOpen}
			{onCancel}
			{onMenu}
		/>
	{/each}
</div>
