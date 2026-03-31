<script lang="ts">
	import { Button, Select } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SearchInput, TablePagination } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { listQuotes } from '$lib/remote/quotes.remote';
	import { QuotesTable } from '$lib/components/quotes';
	import {
		ALL_QUOTE_STATUSES,
		QUOTE_STATUS_LABELS,
		type QuoteStatus
	} from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';
	import type { PaginatedQuotes } from '$lib/remote/quotes.remote';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialQuotes, totalCount } = untrack(() => data);

	// Data state
	let quotesData = $state<PaginatedQuotes>({
		quotes: initialQuotes,
		total: totalCount,
		page: 1,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let loading = $state(false);

	// Filter state
	let search = $state('');
	let statusFilter = $state<QuoteStatus | ''>('');

	// Fetch quotes
	async function fetchQuotes(page = 1) {
		loading = true;
		try {
			quotesData = await listQuotes({
				page,
				perPage: 10,
				search: search || undefined,
				status: statusFilter || undefined
			});
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando presupuestos'));
		} finally {
			loading = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => fetchQuotes(1), 300);
	}

	// Filter change
	function handleFilterChange() {
		fetchQuotes(1);
	}

	// Navigate to quote detail page
	function handleView(quote: QuoteWithRelations) {
		goto(resolve(`/quotes/${quote.id}`));
	}
</script>

<svelte:head>
	<title>Presupuestos - Optikt</title>
</svelte:head>

<div class="p-8">
	<!-- Header -->
	<div class="mb-8 flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Presupuestos</h1>
			<p class="mt-1 text-base text-slate-500">Gestiona los presupuestos de la tienda</p>
		</div>
		<Button color="blue" size="lg" href="/quotes/new">
			<Plus class="mr-2 h-5 w-5" />
			Nuevo Presupuesto
		</Button>
	</div>

	<!-- Filters -->
	<div
		class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
	>
		<SearchInput
			bind:value={search}
			placeholder="Buscar por cliente o vendedor..."
			oninput={handleSearch}
			class="min-w-64 flex-1"
		/>
		<Select bind:value={statusFilter} onchange={handleFilterChange} class="w-48">
			<option value="">Todos los estados</option>
			{#each ALL_QUOTE_STATUSES as s (s)}
				<option value={s}>{QUOTE_STATUS_LABELS[s]}</option>
			{/each}
		</Select>
	</div>

	<!-- Table -->
	<QuotesTable
		quotes={quotesData.quotes}
		{loading}
		onView={handleView}
		onRefresh={() => fetchQuotes(quotesData.page)}
	/>

	<!-- Pagination -->
	{#if quotesData.totalPages > 1}
		<div class="mt-4">
			<TablePagination
				page={quotesData.page}
				totalPages={quotesData.totalPages}
				total={quotesData.total}
				perPage={quotesData.perPage}
				onPageChange={(page) => fetchQuotes(page)}
			/>
		</div>
	{/if}
</div>
