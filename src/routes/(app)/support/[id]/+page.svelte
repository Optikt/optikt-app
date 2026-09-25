<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import SupportTicketPriorityBadge from '$lib/components/support/SupportTicketPriorityBadge.svelte';
	import SupportTicketStatusBadge from '$lib/components/support/SupportTicketStatusBadge.svelte';
	import SupportTicketComments from '$lib/components/support/SupportTicketComments.svelte';
	import {
		getSupportTicketQuery,
		listSupportTicketCommentsQuery,
		updateSupportTicketCommand
	} from '$lib/remote/supportTickets.remote';
	import {
		ALL_TICKET_PRIORITIES,
		ALL_TICKET_STATUSES,
		TICKET_CATEGORY_LABELS,
		TICKET_PRIORITY_LABELS,
		TICKET_RELATED_TYPE_LABELS,
		TICKET_STATUS_LABELS,
		type TicketPriority,
		type TicketStatus
	} from '$lib/shared/enums';
	import { formatDateOnly, getErrorMessage } from '$lib/utils';
	import type {
		SupportTicketCommentRow,
		SupportTicketRow
	} from '$lib/server/db/queries/supportTickets';

	let { data } = $props();

	const canManage = untrack(() => data.canManage);
	const currentUserId = untrack(() => data.currentUserId);

	let ticket = $state<SupportTicketRow>(untrack(() => data.ticket));
	let comments = $state<SupportTicketCommentRow[]>(untrack(() => data.comments));

	let status = $state<TicketStatus>(untrack(() => data.ticket.status));
	let priority = $state<TicketPriority>(untrack(() => data.ticket.priority));
	let saving = $state(false);

	const dirty = $derived(status !== ticket.status || priority !== ticket.priority);

	async function saveChanges() {
		if (!dirty || saving) return;

		saving = true;
		try {
			await updateSupportTicketCommand({ id: ticket.id, status, priority });
			ticket = await getSupportTicketQuery({ id: ticket.id });
			toast.success('Ticket actualizado');
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudo actualizar el ticket'));
		} finally {
			saving = false;
		}
	}

	async function refreshComments() {
		try {
			comments = await listSupportTicketCommentsQuery({ id: ticket.id });
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudieron cargar los comentarios'));
		}
	}

	const selectClass =
		'w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
</script>

<svelte:head>
	<title>{`Ticket #${ticket.number} - Optikt`}</title>
</svelte:head>

<div class="p-4 sm:p-8">
	<PageHeader
		title={`Ticket #${ticket.number}`}
		subtitle={TICKET_CATEGORY_LABELS[ticket.category]}
		backLabel="Volver a soporte"
		backHref="/support"
	/>

	<div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<div class="space-y-6">
			<section class="glass-card px-4 py-4 sm:px-5 sm:py-5">
				<div class="flex flex-wrap items-center gap-2">
					<SupportTicketStatusBadge status={ticket.status} />
					<SupportTicketPriorityBadge priority={ticket.priority} />
				</div>

				<h2 class="mt-3 text-lg font-semibold tracking-[-0.02em] text-brand-navy">
					{ticket.title}
				</h2>
				<p class="mt-2 text-sm whitespace-pre-wrap text-on-surface">{ticket.description}</p>

				<div
					class="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 sm:grid-cols-2"
				>
					<p>
						Reportó:
						<span class="font-medium text-slate-700">{ticket.createdByName ?? '—'}</span>
					</p>
					<p>
						Creado:
						<span class="font-medium text-slate-700">
							{formatDateOnly(ticket.createdAt, { dateStyle: 'medium' })}
						</span>
					</p>
					{#if ticket.relatedType && ticket.relatedLabel}
						<p>
							Relacionado:
							<span class="font-medium text-slate-700">
								{TICKET_RELATED_TYPE_LABELS[ticket.relatedType]} · {ticket.relatedLabel}
							</span>
						</p>
					{/if}
					{#if ticket.resolvedAt}
						<p>
							{ticket.status === 'DISMISSED' ? 'Descartado' : 'Resuelto'}:
							<span class="font-medium text-slate-700">
								{formatDateOnly(ticket.resolvedAt, { dateStyle: 'medium' })}
								{#if ticket.resolvedByName}
									· {ticket.resolvedByName}
								{/if}
							</span>
						</p>
					{/if}
				</div>
			</section>

			<SupportTicketComments
				ticketId={ticket.id}
				{comments}
				{currentUserId}
				onAdded={refreshComments}
			/>
		</div>

		{#if canManage}
			<aside class="glass-card h-fit px-4 py-4 sm:px-5 sm:py-5">
				<h2 class="text-sm font-semibold text-brand-navy">Gestión</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Cambia el estado y la prioridad según el avance.
				</p>

				<div class="mt-4 space-y-3">
					<label class="flex flex-col gap-1.5 text-sm">
						<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Estado
						</span>
						<select bind:value={status} class={selectClass}>
							{#each ALL_TICKET_STATUSES as option (option)}
								<option value={option}>{TICKET_STATUS_LABELS[option]}</option>
							{/each}
						</select>
					</label>

					<label class="flex flex-col gap-1.5 text-sm">
						<span class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase">
							Prioridad
						</span>
						<select bind:value={priority} class={selectClass}>
							{#each ALL_TICKET_PRIORITIES as option (option)}
								<option value={option}>{TICKET_PRIORITY_LABELS[option]}</option>
							{/each}
						</select>
					</label>

					<button
						type="button"
						onclick={saveChanges}
						disabled={!dirty || saving}
						class="w-full rounded-xl bg-brand-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{saving ? 'Guardando...' : 'Guardar cambios'}
					</button>
				</div>
			</aside>
		{/if}
	</div>
</div>
