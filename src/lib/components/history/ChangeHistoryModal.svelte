<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { toast } from 'svelte-sonner';
	import type { EntityType } from '$lib/server/db/schema';
	import { getHistory } from '$lib/remote/history.remote';
	import { getErrorMessage } from '$lib/utils';
	import ChangeHistoryList, { type HistoryEntry } from './ChangeHistoryList.svelte';

	interface Props {
		open: boolean;
		title: string;
		entityType: EntityType;
		entityId: string;
		/** Optional: Map of related entity IDs to their display names */
		relatedNames?: Record<string, string>;
		/** Maximum number of history entries to fetch */
		limit?: number;
		onClose?: () => void;
	}

	let {
		open = $bindable(),
		title,
		entityType,
		entityId,
		relatedNames = {},
		limit = 50,
		onClose
	}: Props = $props();

	// Internal state
	let loading = $state(false);
	let entries = $state<HistoryEntry[]>([]);

	// Fetch history when modal opens
	$effect(() => {
		if (open && entries.length === 0) {
			fetchHistory();
		}
	});

	async function fetchHistory() {
		loading = true;
		try {
			const response = await getHistory({
				entityType,
				entityId,
				limit
			});
			entries = response.entries;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando historial'));
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		onClose?.();
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>📜 Historial de cambios - {title}</Dialog.Title>
		</Dialog.Header>
		<div class="max-h-[60vh] overflow-y-auto pr-2">
			<ChangeHistoryList {entityType} {entries} {loading} {relatedNames} />
		</div>

		<Dialog.Footer class="flex justify-end">
			<Button variant="outline" onclick={handleClose}>Cerrar</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
