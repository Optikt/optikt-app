<script lang="ts">
	import { History } from '@lucide/svelte';
	import AppBadge from '$lib/components/ui/badges/AppBadge.svelte';
	import { ArrowRightLeft, CircleX, Pen, Plus } from '@lucide/svelte';
	import type { QuoteAuditEvent } from './quoteAudit';
	import { formatDate } from '$lib/utils';
	interface Props {
		events: QuoteAuditEvent[];
		createdByName?: string | null;
		createdAt: string;
		/** Abre el drawer; con un id abre ese evento. */
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
			<ol class="space-y-3 px-4 pt-1 pb-3 text-[13px]">
				{#each recentEvents as event (event.id)}
					<li class="flex gap-2.5">
						<span
							class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white {event.tone ===
							'navy'
								? 'bg-brand-navy'
								: event.tone === 'blue'
									? 'bg-brand-blue'
									: event.tone === 'success'
										? 'bg-success'
										: 'bg-error'}"
						>
							{#if event.icon === 'plus'}
								<Plus class="h-3 w-3" />
							{:else if event.icon === 'pen'}
								<Pen class="h-3 w-3" />
							{:else if event.icon === 'convert'}
								<ArrowRightLeft class="h-3 w-3" />
							{:else}
								<CircleX class="h-3 w-3" />
							{/if}
						</span>
						<div class="min-w-0">
							<b class="font-semibold">{event.title}</b>
							<p class="text-on-surface-variant">
								{event.changedByName ?? '—'} ·
								{formatDate(event.changedAt, { dateStyle: 'medium', timeStyle: 'short' })}
							</p>
							{#if event.detail}
								<p class="text-[12px] text-on-surface-variant">{event.detail}</p>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
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
