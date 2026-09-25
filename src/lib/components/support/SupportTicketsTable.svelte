<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import SupportTicketPriorityBadge from './SupportTicketPriorityBadge.svelte';
	import SupportTicketStatusBadge from './SupportTicketStatusBadge.svelte';
	import { TICKET_CATEGORY_LABELS } from '$lib/shared/enums';
	import { formatDateOnly } from '$lib/utils';
	import type { SupportTicketRow } from '$lib/server/db/queries/supportTickets';

	interface Props {
		tickets: SupportTicketRow[];
		loading?: boolean;
		showReporter?: boolean;
		emptyMessage?: string;
	}

	let {
		tickets,
		loading = false,
		showReporter = false,
		emptyMessage = 'No hay tickets registrados'
	}: Props = $props();
</script>

<div class="glass-card overflow-hidden">
	<div class="overflow-x-auto">
		<table class="w-full min-w-[48rem] text-left text-sm">
			<thead
				class="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">#</th>
					<th class="px-4 py-3">Ticket</th>
					<th class="px-4 py-3">Categoría</th>
					<th class="px-4 py-3">Prioridad</th>
					<th class="px-4 py-3">Estado</th>
					{#if showReporter}
						<th class="px-4 py-3">Reportó</th>
					{/if}
					<th class="px-4 py-3">Creado</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200/80">
				{#if loading && tickets.length === 0}
					{#each [1, 2, 3] as row (row)}
						<tr>
							<td colspan={showReporter ? 7 : 6} class="px-4 py-4">
								<div class="h-4 w-full animate-pulse rounded bg-slate-100"></div>
							</td>
						</tr>
					{/each}
				{:else if tickets.length === 0}
					<tr>
						<td colspan={showReporter ? 7 : 6}>
							<EmptyState message={emptyMessage} />
						</td>
					</tr>
				{:else}
					{#each tickets as ticket (ticket.id)}
						<tr class="odd:bg-white even:bg-slate-50/40 hover:bg-slate-50">
							<td class="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">
								#{ticket.number}
							</td>
							<td class="px-4 py-3">
								<a
									href={resolve('/(app)/support/[id]', { id: ticket.id })}
									class="font-medium text-brand-navy no-underline hover:text-brand-blue"
								>
									{ticket.title}
								</a>
								{#if ticket.relatedLabel}
									<p class="mt-0.5 text-xs text-slate-400">{ticket.relatedLabel}</p>
								{/if}
							</td>
							<td class="px-4 py-3 text-xs text-slate-600"
								>{TICKET_CATEGORY_LABELS[ticket.category]}</td
							>
							<td class="px-4 py-3">
								<SupportTicketPriorityBadge priority={ticket.priority} />
							</td>
							<td class="px-4 py-3">
								<SupportTicketStatusBadge status={ticket.status} />
							</td>
							{#if showReporter}
								<td class="px-4 py-3 text-xs text-slate-500">{ticket.createdByName ?? '—'}</td>
							{/if}
							<td class="px-4 py-3 text-xs text-slate-500">
								{formatDateOnly(ticket.createdAt, { dateStyle: 'medium' })}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
