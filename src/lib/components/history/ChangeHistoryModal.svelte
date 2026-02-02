<script lang="ts">
	import { Modal, Button } from 'flowbite-svelte';
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
			console.error(e);
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

<Modal bind:open size="lg" title="📜 Historial de cambios - {title}" outsideclose>
	<div class="max-h-[60vh] overflow-y-auto pr-2">
		<ChangeHistoryList {entityType} {entries} {loading} {relatedNames} />
	</div>

	<div class="mt-6 flex justify-end">
		<Button color="light" onclick={handleClose}>Cerrar</Button>
	</div>
</Modal>
