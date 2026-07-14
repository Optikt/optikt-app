<script lang="ts">
	import type { EntityType, ActionType, ChangeRecord } from '$lib/server/db/schema';
	import ChangeHistoryItem from './ChangeHistoryItem.svelte';

	export interface HistoryEntry {
		id: string;
		action: ActionType;
		changes: ChangeRecord;
		changedAt: string;
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
			<svg class="mx-auto h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
				><circle
					class="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					stroke-width="4"
				/><path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
				/></svg
			>
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
