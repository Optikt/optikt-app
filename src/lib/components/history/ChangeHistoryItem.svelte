<script lang="ts">
	import type { ChangeRecord, EntityType, ActionType } from '$lib/server/db/schema';
	import { actionLabels, actionIcons } from './display-utils';
	import ChangesDiff from './ChangesDiff.svelte';
	import { formatDate } from '$lib/utils';

	interface Props {
		entityType: EntityType;
		action: ActionType;
		changes: ChangeRecord;
		changedAt: string;
		changedByName?: string | null;
		reason?: string | null;
		/** Optional: Map of related entity IDs to their display names */
		relatedNames?: Record<string, string>;
	}

	let {
		entityType,
		action,
		changes,
		changedAt,
		changedByName,
		reason,
		relatedNames = {}
	}: Props = $props();

	const actionColors: Record<ActionType, string> = {
		create: 'bg-green-100 text-green-800',
		update: 'bg-blue-100 text-blue-800',
		delete: 'bg-red-100 text-red-800',
		restore: 'bg-purple-100 text-purple-800'
	};

	const formattedDate = $derived(
		formatDate(changedAt, {
			dateStyle: 'medium',
			timeStyle: 'short'
		})
	);
</script>

<div class="border-l-4 border-gray-200 py-3 pl-4">
	<!-- Header -->
	<div class="mb-2 flex flex-wrap items-center gap-2">
		<span class="text-lg">{actionIcons[action]}</span>
		<span class="rounded-full px-2 py-0.5 text-xs font-medium {actionColors[action]}">
			{actionLabels[action]}
		</span>
		<span class="text-sm text-gray-500">{formattedDate}</span>
		{#if changedByName}
			<span class="text-sm text-gray-400">• por</span>
			<span class="text-sm font-medium text-gray-700">{changedByName}</span>
		{/if}
	</div>

	<!-- Reason if provided -->
	{#if reason}
		<p class="mb-2 text-sm text-gray-600 italic">"{reason}"</p>
	{/if}

	<!-- Changes -->
	{#if action === 'create'}
		<p class="text-sm text-gray-600">Registro creado con {Object.keys(changes).length} campos</p>
	{:else if action === 'delete'}
		<p class="text-sm text-gray-600">Registro eliminado</p>
	{:else if action === 'restore'}
		<p class="text-sm text-gray-600">Registro restaurado</p>
	{:else}
		<ChangesDiff {entityType} {changes} {relatedNames} />
	{/if}
</div>
