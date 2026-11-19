<script lang="ts">
	import { X } from '@lucide/svelte';
	import { AppBadge, SlideOver } from '$lib/components/ui';
	import { matchesAuditFilter, type AuditEvent, type AuditFilter } from '$lib/utils/saleDetail';
	import { formatDate } from '$lib/utils';
	import SaleAuditEvent from './SaleAuditEvent.svelte';

	/**
	 * Presentational audit drawer shared by sales and quotes: filter pills
	 * (Todos / Ediciones / Estados), detailed events and optional «Ver más».
	 * Data loading/classification stays in each document's wrapper.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		events: AuditEvent[];
		/** Total event count for the badge; defaults to the loaded events. */
		total?: number | null;
		createdLabel?: string;
		createdBy?: string | null;
		createdAt: string;
		/** Event id opened expanded (from the rail «N cambios →» link). */
		expandedEventId?: string | null;
		hasMore?: boolean;
		loadingMore?: boolean;
		onLoadMore?: () => void;
	}

	let {
		open,
		onclose,
		events,
		total = null,
		createdLabel = 'Creada por',
		createdBy,
		createdAt,
		expandedEventId = null,
		hasMore = false,
		loadingMore = false,
		onLoadMore
	}: Props = $props();

	let filter = $state<AuditFilter>('all');

	// Each opening starts on «Todos».
	$effect(() => {
		if (open) filter = 'all';
	});

	const filtered = $derived(events.filter((e) => matchesAuditFilter(e, filter)));
	const editsCount = $derived(events.filter((e) => matchesAuditFilter(e, 'edits')).length);
	const statesCount = $derived(events.filter((e) => matchesAuditFilter(e, 'states')).length);

	const FILTERS = $derived([
		{ value: 'all' as const, label: `Todos (${events.length})` },
		{ value: 'edits' as const, label: `Ediciones (${editsCount})` },
		{ value: 'states' as const, label: `Estados (${statesCount})` }
	]);

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
			<AppBadge variant="neutral">{total ?? events.length} eventos</AppBadge>
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
		{#each FILTERS as f (f.value)}
			<button
				type="button"
				onclick={() => (filter = f.value)}
				aria-pressed={filter === f.value}
				class="h-7 rounded-full px-3 text-xs font-semibold transition-colors {pillClasses(
					filter === f.value
				)}"
			>
				{f.label}
			</button>
		{/each}
	</div>

	<div class="py-1">
		{#if filtered.length === 0}
			<div class="mx-0 rounded-2xl bg-surface-container-low p-4">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
					{createdLabel}
				</p>
				<p class="mt-2 font-semibold text-brand-navy">
					{createdBy ?? 'Usuario no disponible'}
				</p>
				<p class="mt-1 text-sm text-on-surface-variant">
					{formatDate(createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>
		{:else}
			{#each filtered as event (event.id)}
				<SaleAuditEvent {event} expanded={expandedEventId === event.id} />
			{/each}
		{/if}
	</div>

	{#if hasMore && onLoadMore}
		<div class="flex justify-center py-3">
			<button
				type="button"
				onclick={onLoadMore}
				disabled={loadingMore}
				aria-disabled={loadingMore}
				class="inline-flex h-9 cursor-pointer items-center rounded-lg border border-outline-variant bg-white px-4 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-60"
			>
				{loadingMore ? 'Cargando…' : 'Ver más'}
			</button>
		</div>
	{/if}
</SlideOver>
