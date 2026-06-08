<script lang="ts">
	import {
		Plus,
		Search,
		RotateCcw,
		ClipboardList,
		FileClock,
		BadgeCheck,
		CircleX
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { PageHeader } from '$lib/components/ui';
	import { getErrorMessage, parsePageParam, replaceUrlSearch, setQueryParam } from '$lib/utils';
	import { listQuotes, getQuoteStats } from '$lib/remote/quotes.remote';
	import { QuotesTable } from '$lib/components/quotes';
	import { canOperate } from '$lib/shared/enums';
	import {
		ALL_QUOTE_STATUSES,
		QUOTE_STATUS_LABELS,
		type QuoteStatus
	} from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations } from '$lib/server/db/queries/quotes';
	import type { PaginatedQuotes, QuoteStats } from '$lib/remote/quotes.remote';
	import { untrack } from 'svelte';

	// Server data
	let { data } = $props();
	let { initialQuotes, totalCount, stats: initialStats } = untrack(() => data);
	const initialQuery = untrack(() => page.url.searchParams);
	const initialPage = parsePageParam(initialQuery.get('page'));
	const initialSearch = initialQuery.get('q') ?? '';
	const initialStatus = initialQuery.get('status');

	function parseQuoteStatus(value: string | null): QuoteStatus | '' {
		if (!value) return '';
		return ALL_QUOTE_STATUSES.includes(value as QuoteStatus) ? (value as QuoteStatus) : '';
	}

	// Data state
	let quotesData = $state<PaginatedQuotes>({
		quotes: initialQuotes,
		total: totalCount,
		page: initialPage,
		perPage: 10,
		totalPages: Math.ceil(totalCount / 10)
	});
	let stats = $state<QuoteStats>(initialStats);
	let loading = $state(false);
	let canAct = $derived(canOperate(data.user.role));

	// Filter state
	let search = $state(initialSearch);
	let statusFilter = $state<QuoteStatus | ''>(parseQuoteStatus(initialStatus));

	function syncUrl(nextPage: number): void {
		replaceUrlSearch(page.url, (params) => {
			setQueryParam(params, 'q', search.trim());
			setQueryParam(params, 'status', statusFilter || null);
			setQueryParam(params, 'page', nextPage > 1 ? nextPage : null);
		});
	}

	// Fetch quotes
	async function fetchQuotes(page = 1) {
		syncUrl(page);
		loading = true;
		try {
			quotesData = await listQuotes({
				page,
				perPage: 10,
				search: search || undefined,
				status: statusFilter || undefined
			}).run();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cargando presupuestos'));
		} finally {
			loading = false;
		}
	}

	async function refreshStats() {
		try {
			stats = await getQuoteStats({}).run();
		} catch (e) {
			console.error(e);
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

	function clearFilters() {
		search = '';
		statusFilter = '';
		fetchQuotes(1);
	}

	let hasActiveFilters = $derived(search.trim().length > 0 || statusFilter !== '');

	// Navigate to quote detail page
	function handleView(quote: QuoteWithRelations) {
		goto(resolve(`/quotes/${quote.id}`));
	}

	function getViewHref(quote: QuoteWithRelations): string {
		return resolve(`/quotes/${quote.id}`);
	}
</script>

<svelte:head>
	<title>Presupuestos - Optikt</title>
</svelte:head>

<div class="p-8">
	<PageHeader title="Presupuestos">
		{#snippet actions()}
			{#if canAct}
				<button
					onclick={() => goto(resolve('/quotes/new'))}
					class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md"
				>
					<Plus size={18} />
					NUEVO PRESUPUESTO
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-highest text-brand-navy"
				>
					<ClipboardList size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
					Presupuestos Mensuales
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">{stats.monthly}</p>
			</div>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
				>
					<FileClock size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-warning-container uppercase">
					Borradores
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">{stats.draft}</p>
			</div>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-info-container text-on-info-container"
				>
					<BadgeCheck size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-info-container uppercase">
					Convertidos
				</p>
				<p class="font-heading text-3xl font-bold text-brand-navy">{stats.converted}</p>
			</div>
		</div>

		<div class="glass-card p-5">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-error-container text-on-error-container"
				>
					<CircleX size={20} />
				</div>
				<p class="text-xs font-semibold tracking-wider text-on-error-container uppercase">
					Cancelados
				</p>
				<p class="font-heading text-3xl font-bold text-error">{stats.cancelled}</p>
			</div>
		</div>
	</div>

	<div
		class="glass-card mb-6 flex flex-col gap-4 bg-surface-container-low p-4 md:flex-row md:items-center"
	>
		<div class="relative flex-1">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-outline" />
			<input
				id="quotes-search"
				name="quotes-search"
				type="search"
				bind:value={search}
				oninput={handleSearch}
				placeholder="Buscar por cliente, vendedor o # de presupuesto..."
				class="w-full rounded-lg border-none bg-surface-container-high p-3 pl-10 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			/>
		</div>

		<div class="flex w-full gap-3 md:w-auto">
			<select
				id="quotes-status-filter"
				name="quotes-status-filter"
				bind:value={statusFilter}
				onchange={handleFilterChange}
				class="min-w-[220px] flex-1 rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 md:flex-none"
			>
				<option value="">Todos los estados</option>
				{#each ALL_QUOTE_STATUSES as s (s)}
					<option value={s}>{QUOTE_STATUS_LABELS[s]}</option>
				{/each}
			</select>

			<button
				onclick={clearFilters}
				disabled={!hasActiveFilters}
				class="inline-flex h-[3rem] w-[3rem] items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 {hasActiveFilters
					? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
					: 'bg-surface-container-high text-outline'}"
				title="Limpiar filtros"
			>
				<RotateCcw size={18} />
			</button>
		</div>
	</div>

	<QuotesTable
		quotes={quotesData.quotes}
		page={quotesData.page}
		perPage={quotesData.perPage}
		total={quotesData.total}
		totalPages={quotesData.totalPages}
		{loading}
		canManage={canAct}
		onView={handleView}
		{getViewHref}
		onRefresh={() => {
			fetchQuotes(quotesData.page);
			refreshStats();
		}}
		onPageChange={(page) => fetchQuotes(page)}
	/>
</div>
