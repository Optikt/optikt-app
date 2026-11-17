<script lang="ts">
	import { X } from '@lucide/svelte';
	import { AppBadge, SlideOver } from '$lib/components/ui';
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import {
		classifySaleAuditEntry,
		matchesAuditFilter,
		type AuditEvent,
		type AuditFilter,
		type ClassifiableAuditEntry
	} from '$lib/utils/saleDetail';
	import { getSaleAuditHistory } from '$lib/remote/history.remote';
	import { formatDate } from '$lib/utils';
	import { getErrorMessage } from '$lib/utils/errors';
	import { logger } from '$lib/utils/logger';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import SaleAuditEvent from './SaleAuditEvent.svelte';

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
	let filter = $state<AuditFilter>('all');
	let loadingMore = $state(false);
	let hasMore = $state(false);

	// Reset the paging state every time the drawer opens.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			entries = [...auditHistory];
			filter = 'all';
			loadingMore = false;
			hasMore =
				auditTotal === null ? auditHistory.length >= PAGE_SIZE : auditHistory.length < auditTotal;
		});
	});

	const auditTimeline = $derived(
		entries.map(classifySaleAuditEntry).filter((e): e is AuditEvent => e !== null)
	);
	const filteredTimeline = $derived(auditTimeline.filter((e) => matchesAuditFilter(e, filter)));
	const editsCount = $derived(auditTimeline.filter((e) => matchesAuditFilter(e, 'edits')).length);
	const statesCount = $derived(auditTimeline.filter((e) => matchesAuditFilter(e, 'states')).length);

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

	function pillClasses(active: boolean): string {
		return active
			? 'bg-brand-navy text-white'
			: 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest';
	}
</script>

<SlideOver {open} {onclose} widthClass="w-full sm:w-[440px]" bodyClass="px-4 py-3">
	{#snippet header({ onclose: close })}
		<div class="flex items-center gap-3 border-b border-outline-variant/15 px-4 py-3.5">
			<h2 class="font-heading min-w-0 flex-1 text-lg font-semibold text-brand-navy">
				Historial de cambios
			</h2>
			<AppBadge variant="neutral">{auditTotal ?? auditTimeline.length} eventos</AppBadge>
			<button
				type="button"
				onclick={close}
				class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
				aria-label="Cerrar"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div
		class="mb-2 flex flex-wrap gap-1.5"
		role="group"
		aria-label="Filtrar historial por tipo de evento"
	>
		<button
			type="button"
			onclick={() => (filter = 'all')}
			aria-pressed={filter === 'all'}
			class="h-7 rounded-full px-3 text-xs font-semibold transition-colors {pillClasses(
				filter === 'all'
			)}"
		>
			Todos ({auditTimeline.length})
		</button>
		<button
			type="button"
			onclick={() => (filter = 'edits')}
			aria-pressed={filter === 'edits'}
			class="h-7 rounded-full px-3 text-xs font-semibold transition-colors {pillClasses(
				filter === 'edits'
			)}"
		>
			Ediciones ({editsCount})
		</button>
		<button
			type="button"
			onclick={() => (filter = 'states')}
			aria-pressed={filter === 'states'}
			class="h-7 rounded-full px-3 text-xs font-semibold transition-colors {pillClasses(
				filter === 'states'
			)}"
		>
			Estados ({statesCount})
		</button>
	</div>

	<div class="py-1">
		{#if filteredTimeline.length === 0}
			<div class="mx-0 rounded-2xl bg-surface-container-low p-4">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">Creada por</p>
				<p class="mt-2 font-semibold text-brand-navy">
					{saleCreatedBy ?? 'Usuario no disponible'}
				</p>
				<p class="mt-1 text-sm text-on-surface-variant">
					{formatDate(saleCreatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>
		{:else}
			{#each filteredTimeline as event (event.id)}
				<SaleAuditEvent {event} expanded={expandedEventId === event.id} />
			{/each}
		{/if}
	</div>

	{#if hasMore}
		<div class="flex justify-center py-3">
			<button
				type="button"
				onclick={loadMore}
				disabled={loadingMore}
				aria-disabled={loadingMore}
				class="inline-flex h-9 cursor-pointer items-center rounded-lg border border-outline-variant bg-white px-4 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-60"
			>
				{loadingMore ? 'Cargando…' : 'Ver más'}
			</button>
		</div>
	{/if}
</SlideOver>
