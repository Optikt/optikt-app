<script lang="ts">
	import { X } from '@lucide/svelte';
	import { AppBadge, SlideOver } from '$lib/components/ui';
	import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
	import { classifySaleAuditEntry, type AuditEvent } from '$lib/utils/saleDetail';
	import { formatDate } from '$lib/utils';
	import SaleAuditEvent from './SaleAuditEvent.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		auditHistory: ChangeHistoryWithUser[];
		saleCreatedAt: string;
		saleCreatedBy?: string | null;
	}

	let { open, onclose, auditHistory, saleCreatedAt, saleCreatedBy }: Props = $props();

	const auditTimeline = $derived(
		auditHistory.map(classifySaleAuditEntry).filter((e): e is AuditEvent => e !== null)
	);
</script>

<SlideOver {open} {onclose} widthClass="w-[440px]" bodyClass="px-0 py-1">
	{#snippet header({ onclose: close })}
		<div class="flex items-center gap-3 border-b border-outline-variant/15 px-5 py-3.5">
			<h2 class="font-heading min-w-0 flex-1 text-lg font-semibold text-brand-navy">
				Historial de cambios
			</h2>
			<AppBadge variant="neutral">{auditTimeline.length} eventos</AppBadge>
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

	<div class="py-1">
		{#if auditTimeline.length === 0}
			<div class="mx-4 rounded-2xl bg-surface-container-low p-4">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">Creada por</p>
				<p class="mt-2 font-semibold text-brand-navy">
					{saleCreatedBy ?? 'Usuario no disponible'}
				</p>
				<p class="mt-1 text-sm text-on-surface-variant">
					{formatDate(saleCreatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>
		{:else}
			{#each auditTimeline as event (event.id)}
				<SaleAuditEvent {event} />
			{/each}
		{/if}
	</div>
</SlideOver>
