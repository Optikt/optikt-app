<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Plus } from '@lucide/svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import TablePagination from '$lib/components/ui/TablePagination.svelte';
	import SupportTicketsTable from '$lib/components/support/SupportTicketsTable.svelte';
	import SupportTicketFormModal from '$lib/components/support/SupportTicketFormModal.svelte';
	import { listSupportTicketsQuery } from '$lib/remote/supportTickets.remote';
	import {
		ALL_TICKET_CATEGORIES,
		ALL_TICKET_PRIORITIES,
		ALL_TICKET_STATUSES,
		TICKET_CATEGORY_LABELS,
		TICKET_PRIORITY_LABELS,
		TICKET_STATUS_LABELS,
		type TicketCategory,
		type TicketPriority,
		type TicketStatus
	} from '$lib/shared/enums';
	import { getErrorMessage } from '$lib/utils';
	import type { PaginatedResult } from '$lib/types';
	import type { SupportTicketRow } from '$lib/server/db/queries/supportTickets';

	let { data } = $props();
	const canManage = untrack(() => data.canManage);

	let ticketsData = $state<PaginatedResult<SupportTicketRow>>(untrack(() => data.initialTickets));
	let loading = $state(false);
	let showFormModal = $state(false);

	let search = $state('');
	let statusFilter = $state<TicketStatus | ''>('');
	let categoryFilter = $state<TicketCategory | ''>('');
	let priorityFilter = $state<TicketPriority | ''>('');

	async function fetchTickets(page = 1) {
		loading = true;
		try {
			ticketsData = await listSupportTicketsQuery({
				page,
				perPage: 10,
				search: search || undefined,
				status: statusFilter || undefined,
				category: categoryFilter || undefined,
				priority: priorityFilter || undefined
			});
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error cargando tickets'));
		} finally {
			loading = false;
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchTickets(1), 300);
	}

	function handleFilterChange() {
		fetchTickets(1);
	}

	function handleCreated() {
		showFormModal = false;
		fetchTickets(1);
	}

	const filterSelectClass =
		'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-brand-blue focus:outline-none sm:w-44';
</script>

<svelte:head>
	<title>Soporte - Optikt</title>
</svelte:head>

<div class="p-4 sm:p-8">
	<PageHeader
		title="Soporte"
		subtitle={canManage ? 'Tickets reportados por el equipo' : 'Tus tickets reportados'}
	>
		{#snippet actions()}
			<button
				type="button"
				onclick={() => (showFormModal = true)}
				class="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-navy transition hover:bg-brand-gold-dark"
			>
				<Plus size={16} />
				Nuevo ticket
			</button>
		{/snippet}
	</PageHeader>

	<div
		class="mt-6 mb-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 lg:grid-cols-4"
	>
		<SearchInput
			bind:value={search}
			placeholder="Buscar por #, título o descripción..."
			oninput={handleSearch}
			class="sm:col-span-2 lg:col-span-1"
		/>
		<select bind:value={statusFilter} onchange={handleFilterChange} class={filterSelectClass}>
			<option value="">Todos los estados</option>
			{#each ALL_TICKET_STATUSES as status (status)}
				<option value={status}>{TICKET_STATUS_LABELS[status]}</option>
			{/each}
		</select>
		<select bind:value={categoryFilter} onchange={handleFilterChange} class={filterSelectClass}>
			<option value="">Todas las categorías</option>
			{#each ALL_TICKET_CATEGORIES as category (category)}
				<option value={category}>{TICKET_CATEGORY_LABELS[category]}</option>
			{/each}
		</select>
		<select bind:value={priorityFilter} onchange={handleFilterChange} class={filterSelectClass}>
			<option value="">Todas las prioridades</option>
			{#each ALL_TICKET_PRIORITIES as priority (priority)}
				<option value={priority}>{TICKET_PRIORITY_LABELS[priority]}</option>
			{/each}
		</select>
	</div>

	<SupportTicketsTable
		tickets={ticketsData.items}
		{loading}
		showReporter={canManage}
		emptyMessage={canManage
			? 'No hay tickets con estos filtros'
			: 'Todavía no has reportado tickets'}
	/>

	<TablePagination
		page={ticketsData.page}
		perPage={ticketsData.perPage}
		total={ticketsData.total}
		totalPages={ticketsData.totalPages}
		onPageChange={(page) => fetchTickets(page)}
	/>
</div>

<SupportTicketFormModal
	bind:open={showFormModal}
	onCreated={handleCreated}
	onClose={() => (showFormModal = false)}
/>
