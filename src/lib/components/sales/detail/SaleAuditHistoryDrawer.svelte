<script lang="ts">
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import {
		classifySaleAuditEntry,
		type AuditEvent,
		type ClassifiableAuditEntry
	} from '$lib/utils/saleDetail';
	import { getSaleAuditHistory } from '$lib/remote/history.remote';
	import { getErrorMessage } from '$lib/utils/errors';
	import { logger } from '$lib/utils/logger';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import AuditEventsDrawer from './AuditEventsDrawer.svelte';

	const PAGE_SIZE = 50;

	interface Props {
		open: boolean;
		onclose: () => void;
		/** First page from the loader (most recent first). */
		auditHistory: ChangeHistoryWithUser[];
		/** Total event count (drives «ver más»); null = unknown. */
		auditTotal?: number | null;
		saleId: string;
		saleCreatedAt: string;
		saleCreatedBy?: string | null;
		/** Event id opened expanded (from the rail «N cambios →» link). */
		expandedEventId?: string | null;
	}

	let {
		open,
		onclose,
		auditHistory,
		auditTotal = null,
		saleId,
		saleCreatedAt,
		saleCreatedBy,
		expandedEventId = null
	}: Props = $props();

	let entries = $state<ClassifiableAuditEntry[]>([]);
	let loadingMore = $state(false);
	let hasMore = $state(false);

	// Reset the paging state every time the drawer opens.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			entries = [...auditHistory];
			loadingMore = false;
			hasMore =
				auditTotal === null ? auditHistory.length >= PAGE_SIZE : auditHistory.length < auditTotal;
		});
	});

	const auditTimeline = $derived(
		entries.map(classifySaleAuditEntry).filter((e): e is AuditEvent => e !== null)
	);

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			const result = await getSaleAuditHistory({
				saleId,
				limit: PAGE_SIZE,
				offset: entries.length
			});
			entries = [...entries, ...result.entries];
			hasMore = result.hasMore;
		} catch (error) {
			logger.error('No se pudo cargar más historial', error);
			toast.error(getErrorMessage(error, 'No se pudo cargar más historial'));
		} finally {
			loadingMore = false;
		}
	}
</script>

<AuditEventsDrawer
	{open}
	{onclose}
	events={auditTimeline}
	total={auditTotal}
	createdBy={saleCreatedBy}
	createdAt={saleCreatedAt}
	{expandedEventId}
	{hasMore}
	{loadingMore}
	onLoadMore={loadMore}
/>
