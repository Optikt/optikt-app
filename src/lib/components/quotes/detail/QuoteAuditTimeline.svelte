<script lang="ts">
	import { History } from '@lucide/svelte';
	import AppBadge from '$lib/components/ui/badges/AppBadge.svelte';
	import SaleAuditEvent from '$lib/components/sales/detail/SaleAuditEvent.svelte';
	import type { AuditEvent } from '$lib/utils/saleDetail';
	import { formatDate } from '$lib/utils';

	interface Props {
		events: AuditEvent[];
		createdByName?: string | null;
		createdAt: string;
		/** Abre el drawer; con un id abre ese evento expandido. */
		onViewAll: (eventId?: string) => void;
	}

	let { events, createdByName, createdAt, onViewAll }: Props = $props();

	const recentEvents = $derived(events.slice(0, 3));
</script>

<section
	class="overflow-hidden rounded-xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm"
>
	<div class="flex flex-wrap items-center gap-2 px-4 pt-3.5 pb-2.5">
		<span class="flex items-center gap-1.5">
			<History class="h-4 w-4 text-brand-blue" />
			<h2 class="font-heading text-[15px] font-bold text-brand-navy">Historial</h2>
		</span>
		<AppBadge variant="neutral">{events.length} eventos</AppBadge>
		<button
			type="button"
			onclick={() => onViewAll()}
			class="ml-auto text-xs font-semibold text-on-info-container underline underline-offset-2 hover:opacity-80"
		>
			Ver todo
		</button>
	</div>

	<div class="pb-1">
		{#if recentEvents.length > 0}
			{#each recentEvents as event (event.id)}
				<SaleAuditEvent {event} dense onExpand={(id) => onViewAll(id)} />
			{/each}
		{:else}
			<div class="px-4 pt-1 pb-3">
				<p class="text-[10px] font-bold tracking-[0.14em] text-outline uppercase">Creado por</p>
				<p class="mt-1 text-[13px] font-semibold text-brand-navy">
					{createdByName ?? 'Usuario no disponible'}
				</p>
				<p class="mt-0.5 text-xs text-on-surface-variant">
					{formatDate(createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
				</p>
			</div>
		{/if}
	</div>
</section>
