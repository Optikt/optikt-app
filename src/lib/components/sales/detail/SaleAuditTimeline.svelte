<script lang="ts">
	import { History } from '@lucide/svelte';
	import { AppBadge } from '$lib/components/ui';
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import { classifySaleAuditEntry, type AuditEvent } from '$lib/utils/saleDetail';
	import { formatDate } from '$lib/utils';
	import SaleAuditEvent from './SaleAuditEvent.svelte';

	interface Props {
		auditHistory: ChangeHistoryWithUser[];
		saleCreatedAt: string;
		saleCreatedBy?: string | null;
		onViewAudit: () => void;
		/** Stock movements linked to this sale (footer shortcut). */
		movementsCount: number;
		onOpenMovements: () => void;
		/** "Última actualización" label (footer, secondary). */
		lastUpdatedLabel: string | null;
	}

	let {
		auditHistory,
		saleCreatedAt,
		saleCreatedBy,
		onViewAudit,
		movementsCount,
		onOpenMovements,
		lastUpdatedLabel
	}: Props = $props();

	const auditTimeline = $derived(
		auditHistory.map(classifySaleAuditEntry).filter((e): e is AuditEvent => e !== null)
	);
	const recentEvents = $derived(auditTimeline.slice(0, 3));
</script>

<section
	class="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm"
>
	<div class="flex flex-wrap items-center gap-2 px-4 pt-3.5 pb-2.5">
		<span class="flex items-center gap-1.5">
			<History class="h-4 w-4 text-brand-blue" />
			<h2 class="font-heading text-[15px] font-bold text-brand-navy">Historial</h2>
		</span>
		<AppBadge variant="neutral">{auditTimeline.length} eventos</AppBadge>
		<button
			type="button"
			onclick={onViewAudit}
			class="ml-auto text-xs font-semibold text-on-info-container underline underline-offset-2 hover:opacity-80"
		>
			Ver todo
		</button>
	</div>

	<div class="pb-1">
		{#if recentEvents.length > 0}
			{#each recentEvents as event (event.id)}
				<SaleAuditEvent {event} dense />
			{/each}
		{:else}
			<div class="px-4 pt-1 pb-3">
				<p class="text-[10px] font-bold tracking-[0.14em] text-outline uppercase">Creada por</p>
				<p class="mt-1 text-[13px] font-semibold text-brand-navy">
					{saleCreatedBy ?? 'Usuario no disponible'}
				</p>
				<p class="mt-0.5 text-xs text-on-surface-variant">
					{formatDate(saleCreatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>
		{/if}
	</div>

	<div
		class="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/60 px-4 py-2.5 text-xs text-on-surface-variant"
	>
		<button
			type="button"
			onclick={onOpenMovements}
			class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-outline-variant bg-white px-2.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low"
		>
			Movimientos de stock ({movementsCount})
		</button>
		{#if lastUpdatedLabel}
			<span class="text-right">Última actualización: {lastUpdatedLabel}</span>
		{/if}
	</div>
</section>
