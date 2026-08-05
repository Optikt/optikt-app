<script lang="ts">
	import { History } from '@lucide/svelte';
	import { AppBadge } from '$lib/components/ui';
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';
	import { formatDate } from '$lib/utils';
	import { classifyAuditEntry, type AuditEvent } from '$lib/utils/purchaseOrderDetail';

	interface Props {
		auditHistory: ChangeHistoryWithUser[];
		purchaseOrder: PurchaseOrderWithRelations;
		onViewAudit: () => void;
	}

	let { auditHistory, purchaseOrder, onViewAudit }: Props = $props();

	const auditTimeline = $derived(
		auditHistory.map(classifyAuditEntry).filter((e): e is AuditEvent => e !== null)
	);
	const recentEvents = $derived(auditTimeline.slice(0, 4));

	function eventDotClass(event: AuditEvent): string {
		const isPayment = event.entityType === 'purchase_order_payment';
		const isVoid = isPayment && event.action === 'update';
		const isCreate = event.action === 'create';
		if (isVoid) return 'bg-error';
		if (isPayment) return 'bg-success';
		if (isCreate) return 'bg-brand-navy';
		return 'bg-outline';
	}
</script>

<div class="rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20 overflow-hidden">
	<div
		class="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 border-b border-outline-variant/30 bg-surface-container-high shrink-0"
	>
		<div class="flex items-center gap-1.5 shrink-0">
			<History class="h-4 w-4 text-brand-blue" />
			<h2 class="text-xs font-semibold uppercase tracking-wide text-brand-navy whitespace-nowrap">
				Auditoría
			</h2>
		</div>
		<AppBadge variant="neutral" class="shrink-0">{auditTimeline.length} eventos</AppBadge>
		<button
			type="button"
			onclick={onViewAudit}
			class="ml-auto text-[10px] font-semibold text-brand-blue uppercase tracking-wide hover:underline shrink-0"
		>
			Ver historial
		</button>
	</div>

	<div class="p-2 space-y-1.5">
		{#if recentEvents.length > 0}
			{#each recentEvents as event (event.id)}
				<div
					class="flex items-start gap-2 rounded-lg bg-surface-container-lowest/50 px-2.5 py-1.5 text-xs"
				>
					<span class={`mt-1 h-2 w-2 rounded-full shrink-0 ${eventDotClass(event)}`}></span>
					<div class="min-w-0">
						<p class="font-medium text-on-surface truncate">{event.label}</p>
						<p class="text-[10px] text-on-surface-variant truncate">
							{event.changedByName ?? 'Usuario desconocido'} · {formatDate(event.changedAt, {
								dateStyle: 'short'
							})}
						</p>
					</div>
				</div>
			{/each}
		{:else}
			<div class="rounded-lg bg-surface-container-lowest/50 px-2.5 py-2">
				<p class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">Creado por</p>
				<p class="mt-0.5 text-xs font-semibold text-brand-navy">
					{purchaseOrder.createdBy?.fullName ?? 'Usuario no disponible'}
				</p>
				<p class="text-[10px] text-on-surface-variant">
					{formatDate(purchaseOrder.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
				</p>
			</div>
		{/if}
	</div>
</div>
