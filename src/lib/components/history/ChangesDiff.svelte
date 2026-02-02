<script lang="ts">
	import type { ChangeRecord, EntityType } from '$lib/server/db/schema';
	import { getFieldLabel, formatChangeValue } from './display-utils';

	interface Props {
		entityType: EntityType;
		changes: ChangeRecord;
		/** Optional: Map of related entity IDs to their display names */
		relatedNames?: Record<string, string>;
	}

	let { entityType, changes, relatedNames = {} }: Props = $props();

	/**
	 * Format a value, resolving IDs to names if available
	 */
	function formatValue(field: string, value: unknown): string {
		// Check if this is a foreign key field and we have a name for it
		if (field.endsWith('Id') && typeof value === 'string' && relatedNames[value]) {
			return relatedNames[value];
		}
		return formatChangeValue(value);
	}

	// Get entries sorted alphabetically by label
	const sortedEntries = $derived(
		Object.entries(changes)
			.map(([field, change]) => ({
				field,
				label: getFieldLabel(entityType, field),
				oldValue: formatValue(field, change.old),
				newValue: formatValue(field, change.new)
			}))
			.sort((a, b) => a.label.localeCompare(b.label))
	);
</script>

<div class="space-y-2">
	{#each sortedEntries as { field, label, oldValue, newValue } (field)}
		<div class="flex items-start gap-2 text-sm">
			<span class="min-w-30 shrink-0 font-medium text-gray-700">{label}:</span>
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-gray-400 line-through">{oldValue}</span>
				<span class="text-gray-400">→</span>
				<span class="font-medium text-gray-900">{newValue}</span>
			</div>
		</div>
	{/each}
</div>
