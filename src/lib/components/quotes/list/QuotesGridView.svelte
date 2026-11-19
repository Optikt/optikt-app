<script lang="ts">
	import QuoteCard from './QuoteCard.svelte';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes/types';

	interface Props {
		quotes: QuoteWithRelations[];
		canManage: boolean;
		/** 'comfortable' (Cuadros) | 'compact' (móvil Lista) — como `SalesGridView`. */
		density?: 'comfortable' | 'compact';
		onOpen: (quote: QuoteWithRelations) => void;
		onEdit: (quote: QuoteWithRelations) => void;
		onDuplicate: (quote: QuoteWithRelations) => void;
		onConvert: (quote: QuoteWithRelations) => void;
		onCancel: (quote: QuoteWithRelations) => void;
		/** Móvil: ⋯ abre la hoja de acciones en vez del popover. */
		onMenu?: (quote: QuoteWithRelations) => void;
	}

	let {
		quotes,
		canManage,
		density = 'comfortable',
		onOpen,
		onEdit,
		onDuplicate,
		onConvert,
		onCancel,
		onMenu
	}: Props = $props();
</script>

<div
	class={density === 'compact'
		? 'flex flex-col gap-2'
		: 'grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3'}
>
	{#each quotes as quote, index (quote.id)}
		<QuoteCard
			{quote}
			{index}
			{density}
			{canManage}
			{onOpen}
			{onEdit}
			{onDuplicate}
			{onConvert}
			{onCancel}
			{onMenu}
		/>
	{/each}
</div>
