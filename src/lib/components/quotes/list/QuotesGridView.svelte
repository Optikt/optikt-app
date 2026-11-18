<script lang="ts">
	import QuoteCard from './QuoteCard.svelte';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';

	interface Props {
		quotes: QuoteWithRelations[];
		canManage: boolean;
		onOpen: (quote: QuoteWithRelations) => void;
		onEdit: (quote: QuoteWithRelations) => void;
		onDuplicate: (quote: QuoteWithRelations) => void;
		onConvert: (quote: QuoteWithRelations) => void;
		onCancel: (quote: QuoteWithRelations) => void;
	}

	let { quotes, canManage, onOpen, onEdit, onDuplicate, onConvert, onCancel }: Props = $props();
</script>

<div class="grid gap-2.5">
	{#each quotes as quote, index (quote.id)}
		<QuoteCard {quote} {index} {canManage} {onOpen} {onEdit} {onDuplicate} {onConvert} {onCancel} />
	{/each}
</div>
