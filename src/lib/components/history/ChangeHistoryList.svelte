<script lang="ts">
	import type { EntityType, ActionType, ChangeRecord } from '$lib/server/db/schema';
	import ChangeHistoryItem from './ChangeHistoryItem.svelte';
	import { Spinner } from 'flowbite-svelte';

	export interface HistoryEntry {
		id: string;
		action: ActionType;
		changes: ChangeRecord;
		changedAt: Date;
		changedByName?: string | null;
		reason?: string | null;
	}

	interface Props {
		entityType: EntityType;
		entries: HistoryEntry[];
		loading?: boolean;
		/** Optional: Map of related entity IDs to their display names */
		relatedNames?: Record<string, string>;
	}

	let { entityType, entries, loading = false, relatedNames = {} }: Props = $props();
</script>

<div class="space-y-4">
	{#if loading}
		<div class="flex justify-center py-8">
			<Spinner size="8" />
		</div>
	{:else if entries.length === 0}
		<div class="py-8 text-center text-gray-500">
			<p>No hay historial de cambios</p>
		</div>
	{:else}
		{#each entries as entry (entry.id)}
			<ChangeHistoryItem
				{entityType}
				action={entry.action}
				changes={entry.changes}
				changedAt={entry.changedAt}
				changedByName={entry.changedByName}
				reason={entry.reason}
				{relatedNames}
			/>
		{/each}
	{/if}
</div>
