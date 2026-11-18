<script lang="ts">
	import { ArrowRightLeft, CircleX, Pen, Plus, X } from '@lucide/svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { formatDate } from '$lib/utils';
	import {
		matchesQuoteAuditFilter,
		type QuoteAuditEvent,
		type QuoteAuditFilter
	} from './quoteAudit';

	interface Props {
		open: boolean;
		events: QuoteAuditEvent[];
	}

	let { open, events }: Props = $props();

	let filter = $state<QuoteAuditFilter>('all');

	const FILTERS: { value: QuoteAuditFilter; label: string }[] = [
		{ value: 'all', label: 'Todos' },
		{ value: 'edits', label: 'Ediciones' },
		{ value: 'states', label: 'Estados' }
	];

	const visible = $derived(events.filter((e) => matchesQuoteAuditFilter(e, filter)));
</script>

<SlideOver bind:open direction="right" widthClass="w-full sm:w-[440px]" bodyClass="p-0">
	{#snippet header({ onclose: close })}
		<div class="flex items-center justify-between px-5 pt-4 pb-2">
			<h2 class="font-heading text-lg font-bold text-brand-navy">Historial del presupuesto</h2>
			<button
				type="button"
				onclick={close}
				aria-label="Cerrar historial"
				class="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
			>
				<X class="h-5 w-5" />
			</button>
		</div>
	{/snippet}

	<div class="flex gap-1.5 px-5 pb-3">
		{#each FILTERS as f (f.value)}
			<button
				type="button"
				aria-pressed={filter === f.value}
				onclick={() => (filter = f.value)}
				class="inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors {filter ===
				f.value
					? 'border-brand-navy bg-brand-navy text-white'
					: 'border-outline-variant/60 bg-white text-on-surface-variant hover:border-brand-blue'}"
			>
				{f.label}
			</button>
		{/each}
	</div>

	<ol class="space-y-4 px-5 pb-6 text-[13px]">
		{#each visible as event (event.id)}
			<li class="flex gap-2.5">
				<span
					class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white {event.tone ===
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
						<TriggerTooltip text={event.detail}>
							{#snippet trigger({ props }: { props: Record<string, unknown> })}
								<p {...props} class="cursor-help text-[12px] text-on-surface-variant">
									{event.detail}
								</p>
							{/snippet}
						</TriggerTooltip>
					{/if}
				</div>
			</li>
		{:else}
			<li class="text-on-surface-variant italic">Sin eventos con este filtro</li>
		{/each}
	</ol>
</SlideOver>
