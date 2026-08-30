<script lang="ts">
	import { History } from '@lucide/svelte';
	import { AppBadge } from '$lib/components/ui';
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import { formatDate } from '$lib/utils';
	import { classifySaleAuditEntry, type AuditEvent } from '$lib/utils/saleDetail';

	interface Props {
		auditHistory: ChangeHistoryWithUser[];
		saleCreatedAt: string;
		saleCreatedBy?: string | null;
		onViewAudit: () => void;
	}

	let { auditHistory, saleCreatedAt, saleCreatedBy, onViewAudit }: Props = $props();

	const auditTimeline = $derived(
		auditHistory.map(classifySaleAuditEntry).filter((e): e is AuditEvent => e !== null)
	);
	const recentEvents = $derived(auditTimeline.slice(0, 4));

	function eventDotClass(event: AuditEvent): string {
		const isCreate = event.action === 'create';
		const isStatus = event.label.startsWith('Estado:');
		if (isCreate) return 'bg-brand-navy';
		if (isStatus) return 'bg-brand-blue';
		return 'bg-outline';
	}
</script>

<div class="overflow-hidden rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20">
	<div
		class="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-outline-variant/30 bg-surface-container-high px-3 py-2.5"
	>
		<div class="flex shrink-0 items-center gap-1.5">
			<History class="h-4 w-4 text-brand-blue" />
			<h2 class="text-xs font-semibold tracking-wide whitespace-nowrap text-brand-navy uppercase">
				Historial
			</h2>
		</div>
		<AppBadge variant="neutral" class="shrink-0">{auditTimeline.length} eventos</AppBadge>
		<button
			type="button"
			onclick={onViewAudit}
			class="ml-auto shrink-0 text-[10px] font-semibold tracking-wide text-brand-blue uppercase hover:underline"
		>
			Ver historial
		</button>
	</div>

	<div class="space-y-1.5 p-2">
		{#if recentEvents.length > 0}
			{#each recentEvents as event (event.id)}
				<div
					class="flex items-start gap-2 rounded-lg bg-surface-container-lowest/50 px-2.5 py-1.5 text-xs"
				>
					<span class={`mt-1 h-2 w-2 shrink-0 rounded-full ${eventDotClass(event)}`}></span>
					<div class="min-w-0">
						<p class="truncate font-medium text-on-surface">{event.label}</p>
						<p class="truncate text-[10px] text-on-surface-variant">
							{event.changedByName ?? 'Usuario desconocido'} · {formatDate(event.changedAt, {
								dateStyle: 'short'
							})}
						</p>
					</div>
				</div>
			{/each}
		{:else}
			<div class="rounded-lg bg-surface-container-lowest/50 px-2.5 py-2">
				<p class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">Creada por</p>
				<p class="mt-0.5 text-xs font-semibold text-brand-navy">
					{saleCreatedBy ?? 'Usuario no disponible'}
				</p>
				<p class="text-[10px] text-on-surface-variant">
					{formatDate(saleCreatedAt, { dateStyle: 'short', timeStyle: 'short' })}
				</p>
			</div>
		{/if}
	</div>
</div>
