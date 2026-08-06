<script lang="ts">
	import { History, X } from '@lucide/svelte';
	import { SlideOver } from '$lib/components/ui';
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import type { PurchaseOrderWithRelations } from '$lib/server/db/queries/purchaseOrders';
	import { formatDate } from '$lib/utils';
	import { classifyAuditEntry, type AuditEvent } from '$lib/utils/purchaseOrderDetail';

	interface Props {
		open: boolean;
		onclose: () => void;
		auditHistory: ChangeHistoryWithUser[];
		purchaseOrder: PurchaseOrderWithRelations;
	}

	let { open, onclose, auditHistory, purchaseOrder }: Props = $props();

	const auditTimeline = $derived(
		auditHistory.map(classifyAuditEntry).filter((e): e is AuditEvent => e !== null)
	);
</script>

<SlideOver {open} {onclose} size="lg">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-outline-variant/15 px-6 py-4">
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
				>
					<History class="h-5 w-5" />
				</div>
				<div>
					<h2 class="text-lg font-semibold text-brand-navy">Historial de auditoría</h2>
					<p class="text-xs text-on-surface-variant">
						{auditTimeline.length} evento{auditTimeline.length !== 1 ? 's' : ''}
					</p>
				</div>
			</div>
			<button
				type="button"
				onclick={onclose}
				class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
				aria-label="Cerrar"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div class="px-6 py-5">
		{#if auditTimeline.length === 0}
			<div class="space-y-4">
				<div class="rounded-2xl bg-surface-container-low p-4">
					<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
						Creado por
					</p>
					<p class="mt-2 font-semibold text-brand-navy">
						{purchaseOrder.createdBy?.fullName ?? 'Usuario no disponible'}
					</p>
					<p class="mt-1 text-sm text-on-surface-variant">
						{formatDate(purchaseOrder.createdAt, {
							dateStyle: 'medium',
							timeStyle: 'short'
						})}
					</p>
				</div>
				{#if purchaseOrder.confirmedAt}
					<div class="rounded-2xl bg-surface-container-low p-4">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Confirmado por
						</p>
						<p class="mt-2 font-semibold text-brand-navy">
							{purchaseOrder.confirmedBy?.fullName ?? 'Usuario no disponible'}
						</p>
						<p class="mt-1 text-sm text-on-surface-variant">
							{formatDate(purchaseOrder.confirmedAt, {
								dateStyle: 'medium',
								timeStyle: 'short'
							})}
						</p>
					</div>
				{/if}
			</div>
		{:else}
			<ol class="relative border-l border-outline-variant/25">
				{#each auditTimeline as event (event.id)}
					{@const isPayment = event.entityType === 'purchase_order_payment'}
					{@const isVoid = isPayment && event.action === 'update'}
					{@const isCreate = event.action === 'create'}
					<li class="ms-5 mb-6 last:mb-0">
						<span
							class="absolute -start-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full ring-4 ring-surface-container-lowest
							{isVoid
								? 'bg-error-container text-on-error-container'
								: isPayment
									? 'bg-success/15 text-success'
									: isCreate
										? 'bg-brand-navy/10 text-brand-navy'
										: 'bg-surface-container-high text-on-surface-variant'}"
						>
							{#if isVoid}
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									class="h-2.5 w-2.5"><path d="M18 6 6 18M6 6l12 12" /></svg
								>
							{:else if isPayment}
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									class="h-2.5 w-2.5"><path d="M12 5v14M5 12h14" /></svg
								>
							{:else if isCreate}
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									class="h-2.5 w-2.5"><path d="M12 5v14M5 12h14" /></svg
								>
							{:else}
								<svg viewBox="0 0 24 24" fill="currentColor" class="h-1.5 w-1.5"
									><circle cx="12" cy="12" r="6" /></svg
								>
							{/if}
						</span>
						<p class="text-sm font-semibold text-on-surface {isVoid ? 'text-error' : ''}">
							{event.label}
						</p>
						<p class="mt-0.5 text-xs text-on-surface-variant">
							{event.changedByName ?? 'Usuario desconocido'}
						</p>
						<time class="mt-0.5 block font-mono text-[11px] text-outline tabular-nums">
							{formatDate(event.changedAt, { dateStyle: 'short', timeStyle: 'short' })}
						</time>
					</li>
				{/each}
			</ol>
		{/if}
	</div>
</SlideOver>
