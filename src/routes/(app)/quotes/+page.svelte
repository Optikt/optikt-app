<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import {
		getErrorMessage,
		logger,
		parsePageParam,
		replaceUrlSearch,
		saveReferrerParams,
		setQueryParam
	} from '$lib/utils';
	import { listQuotes, getQuoteStats, getQuoteFacets } from '$lib/remote/quotes/queries.remote';
	import { cancelQuote } from '$lib/remote/quotes/lifecycle.remote';
	import SaleListHeader from '$lib/components/sales/SaleListHeader.svelte';
	import SaleFilterBar from '$lib/components/sales/SaleFilterBar.svelte';
	import SaleStatusTabs from '$lib/components/sales/SaleStatusTabs.svelte';
	import SaleFilterChips from '$lib/components/sales/SaleFilterChips.svelte';
	import SaleListFooter from '$lib/components/sales/SaleListFooter.svelte';
	import QuoteKpiCards from '$lib/components/quotes/list/QuoteKpiCards.svelte';
	import QuotesListView from '$lib/components/quotes/list/QuotesListView.svelte';
	import QuotesGridView from '$lib/components/quotes/list/QuotesGridView.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import { FileText } from '@lucide/svelte';
	import {
		DEFAULT_QUOTE_LIST_PER_PAGE,
		DEFAULT_QUOTE_LIST_SORT,
		parseIsoDateOnly,
		parseQuoteListSort,
		saleListDatePreset,
		saleListPresetRange,
		type QuoteListSort,
		type SaleDatePreset
	} from '$lib/components/quotes/list/quoteListParams';
	import { formatQuoteNumber } from '$lib/components/quotes/list/quoteListDisplay';
	import { canOperate } from '$lib/shared/enums';
	import {
		ALL_QUOTE_STATUSES,
		QUOTE_STATUS_LABELS,
		QuoteStatus,
		type QuoteStatus as QuoteStatusType
	} from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations, QuoteStats } from '$lib/server/db/queries/quotes';
	import type { PaginatedQuotes } from '$lib/remote/quotes/queries.remote';

	// ── Datos iniciales (SSR) ────────────────────────────────────────────────
	let { data } = $props();
	const {
		quotes: initialQuotes,
		total: initialTotal,
		selection: initialSelection,
		page: initialPageNumber,
		totalPages: initialTotalPages,
		stats: initialStats,
		sellers: initialSellers
	} = untrack(() => data);
	const initialQuery = untrack(() => page.url.searchParams);

	const initialPage = parsePageParam(initialQuery.get('page'));
	const initialSearch = initialQuery.get('q') ?? '';
	const initialStatus = initialQuery.get('status');
	const initialStatuses = initialStatus
		? ALL_QUOTE_STATUSES.includes(initialStatus as QuoteStatusType)
			? [initialStatus as QuoteStatusType]
			: []
		: [];
	const initialSeller = initialQuery.get('seller') ?? '';
	const initialFrom = parseIsoDateOnly(initialQuery.get('from'));
	const initialTo = parseIsoDateOnly(initialQuery.get('to'));
	const initialSort = parseQuoteListSort(initialQuery.get('sort'));
	const initialPer = Number.parseInt(initialQuery.get('per') ?? '', 10);

	// ── Estado ───────────────────────────────────────────────────────────────
	let quotesData = $state<PaginatedQuotes>({
		quotes: initialQuotes,
		total: initialTotal,
		page: initialPageNumber,
		perPage: [10, 25, 50].includes(initialPer) ? initialPer : DEFAULT_QUOTE_LIST_PER_PAGE,
		totalPages: initialTotalPages,
		selection: initialSelection
	});
	/** Conteos por estado (pestañas), viene del loader y se refresca con cada fetch. */
	let facets = $state<Record<string, number>>(untrack(() => data.facets) as Record<string, number>);
	let stats = $state<QuoteStats>(initialStats);
	let sellers = $state(initialSellers);
	let loading = $state(false);

	// Filtros (URL = fuente de verdad)
	let search = $state(initialSearch);
	let statuses = $state<QuoteStatusType[]>(initialStatuses);
	let sellerId = $state(initialSeller);
	let preset = $state<SaleDatePreset>(saleListDatePreset(initialFrom, initialTo, new Date()));
	let from = $state(initialFrom);
	let to = $state(initialTo);
	let sort = $state(initialSort);
	let per = $state([10, 25, 50].includes(initialPer) ? initialPer : DEFAULT_QUOTE_LIST_PER_PAGE);
	let currentPage = $state(initialPage);

	const canAct = $derived(canOperate(data.user.role));

	// ── URL ──────────────────────────────────────────────────────────────────
	function syncUrl(nextPage: number): void {
		replaceUrlSearch(page.url, (params) => {
			setQueryParam(params, 'q', search.trim());
			setQueryParam(params, 'status', statuses[0] ?? null);
			setQueryParam(params, 'seller', sellerId);
			setQueryParam(params, 'from', from);
			setQueryParam(params, 'to', to);
			setQueryParam(params, 'sort', sort === DEFAULT_QUOTE_LIST_SORT ? null : sort);
			setQueryParam(params, 'per', per === DEFAULT_QUOTE_LIST_PER_PAGE ? null : per);
			setQueryParam(params, 'page', nextPage > 1 ? nextPage : null);
		});
	}

	// ── Fetch ────────────────────────────────────────────────────────────────
	async function fetchQuotes(nextPage: number): Promise<void> {
		currentPage = nextPage;
		syncUrl(nextPage);
		loading = true;
		try {
			const [list, newStats, newFacets] = await Promise.all([
				listQuotes({
					page: nextPage,
					perPage: per,
					search: search.trim() || undefined,
					status: statuses[0] ?? undefined,
					sellerId: sellerId || undefined,
					dateFrom: from ?? undefined,
					dateTo: to ?? undefined,
					sort
				}),
				getQuoteStats({}),
				getQuoteFacets({
					page: 1,
					perPage: 1,
					search: search.trim() || undefined,
					status: statuses[0] ?? undefined,
					sellerId: sellerId || undefined,
					dateFrom: from ?? undefined,
					dateTo: to ?? undefined
				})
			]);
			quotesData = list;
			stats = newStats;
			facets = newFacets.counts as unknown as Record<string, number>;
		} catch (e) {
			logger.error('Error cargando presupuestos', e);
			toast.error(getErrorMessage(e, 'Error cargando presupuestos'));
		} finally {
			loading = false;
		}
	}

	// ── Handlers de filtro ───────────────────────────────────────────────────
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;
	function handleSearch(value: string): void {
		search = value;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => void fetchQuotes(1), 300);
	}

	function handleStatusesChange(next: QuoteStatusType[]): void {
		statuses = next;
		void fetchQuotes(1);
	}

	function handleSellerChange(next: string): void {
		sellerId = next;
		void fetchQuotes(1);
	}

	function handlePresetChange(next: SaleDatePreset): void {
		preset = next;
		const range = saleListPresetRange(next, new Date());
		from = range.from;
		to = range.to;
		void fetchQuotes(1);
	}

	function handleRangeChange(nextFrom: string | null, nextTo: string | null): void {
		from = nextFrom;
		to = nextTo;
		preset = saleListDatePreset(nextFrom, nextTo, new Date());
		void fetchQuotes(1);
	}

	function handleSortChange(next: QuoteListSort): void {
		sort = next;
		void fetchQuotes(1);
	}

	function handlePerPageChange(next: number): void {
		per = next;
		void fetchQuotes(1);
	}

	function clearFilters(): void {
		search = '';
		statuses = [];
		sellerId = '';
		preset = 'all';
		from = null;
		to = null;
		void fetchQuotes(1);
	}

	// ── Chips ────────────────────────────────────────────────────────────────
	const PRESET_LABELS: Record<string, string> = {
		today: 'Hoy',
		'7d': 'Últimos 7 días',
		month: 'Este mes',
		custom: 'Rango de fechas'
	};

	const chips = $derived.by(() => {
		const list: { id: string; label: string; onRemove: () => void }[] = [];
		for (const status of statuses) {
			list.push({
				id: `status:${status}`,
				label: QUOTE_STATUS_LABELS[status],
				onRemove: () => handleStatusesChange(statuses.filter((s) => s !== status))
			});
		}
		if (sellerId) {
			list.push({
				id: 'seller',
				label: `Vendedor: ${sellers.find((s) => s.id === sellerId)?.fullName ?? ''}`,
				onRemove: () => handleSellerChange('')
			});
		}
		if (preset !== 'all') {
			list.push({
				id: 'range',
				label: PRESET_LABELS[preset] ?? 'Rango de fechas',
				onRemove: () => handlePresetChange('all')
			});
		}
		return list;
	});

	// ── KPIs ─────────────────────────────────────────────────────────────────
	function handleKpiSelect(kpi: 'open' | 'month' | 'converted'): void {
		if (kpi === 'open') {
			statuses = [QuoteStatus.DRAFT];
			sort = 'total';
		} else {
			const range = saleListPresetRange('month', new Date());
			preset = 'month';
			from = range.from;
			to = range.to;
			if (kpi === 'converted') statuses = [QuoteStatus.CONVERTED];
		}
		void fetchQuotes(1);
	}

	// ── Navegación / acciones ────────────────────────────────────────────────
	function handleView(quote: QuoteWithRelations): void {
		void goto(resolve(`/quotes/${quote.id}`));
	}

	function handleEdit(quote: QuoteWithRelations): void {
		void goto(resolve(`/quotes/${quote.id}?action=edit`));
	}

	function handleDuplicate(quote: QuoteWithRelations): void {
		void goto(resolve(`/quotes/new?from=${quote.id}`));
	}

	function handleConvert(quote: QuoteWithRelations): void {
		void goto(resolve(`/quotes/${quote.id}?action=convert`));
	}

	// ── Cancelación (modal en el listado) ────────────────────────────────────
	let cancelTarget = $state<QuoteWithRelations | null>(null);
	let cancelOpen = $state(false);
	let cancelling = $state(false);

	function handleCancelRequest(quote: QuoteWithRelations): void {
		cancelTarget = quote;
		cancelOpen = true;
	}

	async function handleCancelConfirm(): Promise<void> {
		if (!cancelTarget) return;
		cancelling = true;
		try {
			const result = await cancelQuote({ id: cancelTarget.id });
			if (result.success) {
				toast.success('Presupuesto cancelado');
				cancelOpen = false;
				cancelTarget = null;
				await fetchQuotes(currentPage);
			} else {
				toast.error(result.error ?? 'Error cancelando presupuesto');
			}
		} catch (e) {
			logger.error('Error cancelando presupuesto', e);
			toast.error(getErrorMessage(e, 'Error cancelando presupuesto'));
		} finally {
			cancelling = false;
		}
	}

	// ── Convertir desde el listado: navega al detalle con ?action=convert ────

	beforeNavigate(({ to }) => {
		const path = to?.url.pathname ?? '';
		if (path !== '/quotes' && path.startsWith('/quotes')) {
			saveReferrerParams('/quotes');
		}
	});
</script>

<svelte:head>
	<title>Presupuestos - Optikt</title>
</svelte:head>

<div
	class="animate-rise @container mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-5 pt-3.5 pb-7 min-[1440px]:max-w-[1440px] min-[1920px]:max-w-[1600px] min-[2400px]:max-w-[1920px]"
>
	<SaleListHeader
		totalCount={stats.total}
		view="list"
		canCreate={canAct}
		onViewChange={() => undefined}
		title="Presupuestos"
		countNounOne="presupuesto registrado"
		countNounMany="presupuestos registrados"
		createLabel="Nuevo presupuesto"
		onCreate={() => goto(resolve('/quotes/new'))}
		showViewToggle={false}
	/>

	<QuoteKpiCards {stats} onSelect={handleKpiSelect} />

	<section
		class="flex flex-col gap-2.5 rounded-[var(--ds-radius-lg)] bg-white p-2.5 shadow-[var(--ds-shadow-sm)] lg:p-3"
	>
		<SaleFilterBar
			{search}
			{sellerId}
			{sellers}
			{preset}
			{from}
			{to}
			{sort}
			onSearch={handleSearch}
			onSellerChange={handleSellerChange}
			onPresetChange={handlePresetChange}
			onRangeChange={handleRangeChange}
			onSortChange={(next) => handleSortChange(next as QuoteListSort)}
			searchPlaceholder="Buscar por cliente, vendedor o # de presupuesto…"
			sortOptions={[
				{ value: 'recent', label: 'Más recientes' },
				{ value: 'total', label: 'Mayor total' },
				{ value: 'expiring', label: 'Vencen primero' }
			]}
			ariaLabel="Buscar presupuestos"
		/>

		<SaleStatusTabs
			statuses={ALL_QUOTE_STATUSES.filter((s) => s !== QuoteStatus.EXPIRED)}
			labels={QUOTE_STATUS_LABELS}
			counts={facets}
			value={statuses}
			onchange={(next) => handleStatusesChange(next as QuoteStatusType[])}
			ariaLabel="Filtrar por estado"
			allLabel="Todos"
		/>

		<SaleFilterChips {chips} onClear={clearFilters} />
	</section>

	<p class="sr-only" aria-live="polite">{quotesData.total} presupuestos</p>

	<div
		class="overflow-hidden rounded-[var(--ds-radius-lg)] bg-white shadow-[var(--ds-shadow-sm)] {loading &&
		quotesData.quotes.length > 0
			? 'pointer-events-none opacity-60'
			: ''}"
		aria-busy={loading}
	>
		{#if loading && quotesData.quotes.length === 0}
			<div class="h-[38px] border-b border-outline-variant/70 bg-surface-container-low"></div>
			{#each Array(7) as _, i (i)}
				<div class="flex h-[58px] items-center gap-4 border-b border-outline-variant/40 px-3">
					<div class="h-3 w-16 animate-pulse rounded bg-surface-container-high"></div>
					<div class="h-3 w-40 animate-pulse rounded bg-surface-container-high"></div>
					<div class="h-3 w-20 animate-pulse rounded bg-surface-container-high"></div>
					<div class="h-3 w-16 animate-pulse rounded bg-surface-container-high"></div>
					<div class="h-3 w-32 animate-pulse rounded bg-surface-container-high"></div>
				</div>
			{/each}
		{:else if quotesData.quotes.length === 0}
			{#snippet quoteIcon()}
				<FileText class="h-10 w-10" />
			{/snippet}
			<div class="flex flex-col items-center px-4 py-10">
				<EmptyState icon={quoteIcon} message="No se encontraron presupuestos" />
				{#if chips.length > 0 || search.trim().length > 0}
					<button
						type="button"
						onclick={clearFilters}
						class="mt-3 inline-flex h-9 items-center rounded-[var(--ds-radius-md)] bg-brand-navy px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-navy-dark"
					>
						Limpiar filtros
					</button>
				{/if}
			</div>
		{:else}
			<!-- Mobile: tarjetas (la tabla no cabe) -->
			<div class="p-3 lg:hidden">
				<QuotesGridView
					quotes={quotesData.quotes}
					canManage={canAct}
					onOpen={handleView}
					onEdit={handleEdit}
					onDuplicate={handleDuplicate}
					onConvert={handleConvert}
					onCancel={handleCancelRequest}
				/>
			</div>
			<div class="hidden lg:block">
				<QuotesListView
					quotes={quotesData.quotes}
					canManage={canAct}
					onOpen={handleView}
					onEdit={handleEdit}
					onDuplicate={handleDuplicate}
					onConvert={handleConvert}
					onCancel={handleCancelRequest}
				/>
			</div>

			<SaleListFooter
				page={quotesData.page}
				perPage={quotesData.perPage}
				total={quotesData.total}
				totalPages={quotesData.totalPages}
				selection={quotesData.selection}
				showPerPage={true}
				onPageChange={(next) => void fetchQuotes(next)}
				onPerPageChange={handlePerPageChange}
				unitNounOne="presupuesto"
				unitNounMany="presupuestos"
				selectionTooltip="Suma de los {quotesData.total} presupuestos que cumplen los filtros"
			/>
		{/if}
	</div>
</div>

{#if cancelTarget}
	<ConfirmModal
		bind:open={cancelOpen}
		title="Cancelar presupuesto"
		message={`¿Está seguro que desea cancelar el presupuesto ${formatQuoteNumber(cancelTarget.quoteNumber)}? Esta acción no se puede deshacer.`}
		confirmLabel="Cancelar presupuesto"
		confirmColor="red"
		loading={cancelling}
		onConfirm={handleCancelConfirm}
		onCancel={() => {
			cancelOpen = false;
			cancelTarget = null;
		}}
	/>
{/if}
