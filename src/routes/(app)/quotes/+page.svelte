<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { getAppMainScroll } from '$lib/utils/scroll';
	import { getErrorMessage } from '$lib/utils/errors';
	import { logger } from '$lib/utils/logger';
	import {
		parseBooleanParam,
		parsePageParam,
		replaceUrlSearch,
		saveReferrerParams,
		setQueryParam
	} from '$lib/utils/urlState';
	import { listQuotes, getQuoteStats, getQuoteFacets } from '$lib/remote/quotes/queries.remote';
	import { cancelQuote } from '$lib/remote/quotes/lifecycle.remote';
	import QuoteListDesktop from '$lib/components/quotes/list/QuoteListDesktop.svelte';
	import QuoteListMobile from '$lib/components/quotes/list/QuoteListMobile.svelte';
	import QuoteMobileOverlays from '$lib/components/quotes/list/QuoteMobileOverlays.svelte';
	import SaleListSkeleton from '$lib/components/sales/SaleListSkeleton.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import Fab from '$lib/components/ui/Fab.svelte';
	import { persistListView } from '$lib/components/sales/listViewPreference';
	import {
		DEFAULT_SALE_LIST_VIEW,
		SALE_DATE_PRESET_LABELS,
		parseSaleListView,
		type SaleListView
	} from '$lib/components/sales/listParams';
	import type { SaleFilterChip } from '$lib/components/sales/saleListContext';
	import {
		DEFAULT_QUOTE_LIST_PER_PAGE,
		DEFAULT_QUOTE_LIST_SORT,
		parseIsoDateOnly,
		parseQuoteListPerPage,
		parseQuoteListSort,
		parseQuoteStatuses,
		serializeQuoteStatuses,
		saleListDatePreset,
		saleListPresetRange,
		type QuoteListSort,
		type SaleDatePreset
	} from '$lib/components/quotes/list/quoteListParams';
	import {
		QUOTE_LIST_KEY,
		type QuoteListContext,
		type QuoteListKpi,
		type QuoteMobileUi
	} from '$lib/components/quotes/list/quoteListContext';
	import { formatQuoteNumber } from '$lib/components/quotes/list/quoteListDisplay';
	import { canOperate } from '$lib/shared/enums';
	import {
		QUOTE_STATUS_LABELS,
		QuoteStatus,
		type QuoteStatus as QuoteStatusType
	} from '$lib/shared/contracts/quotes';
	import type { QuoteWithRelations, QuoteStats } from '$lib/server/db/queries/quotes/types';
	import type { PaginatedQuotes } from '$lib/remote/quotes/queries.remote';

	// ── Datos iniciales (SSR) ────────────────────────────────────────────────
	let { data } = $props();
	const initial = untrack(() => data);
	const initialQuery = untrack(() => page.url.searchParams);
	const initialFrom = parseIsoDateOnly(initialQuery.get('from'));
	const initialTo = parseIsoDateOnly(initialQuery.get('to'));

	// ── Estado ───────────────────────────────────────────────────────────────
	let quotesData = $state<PaginatedQuotes>({
		quotes: initial.quotes,
		total: initial.total,
		page: initial.page,
		perPage: initial.perPage,
		totalPages: initial.totalPages,
		selection: initial.selection
	});
	/** Conteos por estado (pestañas), del loader y refrescados con cada fetch. */
	let facets = $state<Record<string, number>>(initial.facets as Record<string, number>);
	let stats = $state<QuoteStats>(initial.stats);
	const sellers = initial.sellers;
	let loading = $state(false);

	// Filtros (URL = fuente de verdad). Vista: misma preferencia que ventas.
	let view = $state<SaleListView>(
		parseSaleListView(initialQuery.get('view')) ?? initial.preferredView ?? DEFAULT_SALE_LIST_VIEW
	);
	let search = $state(initialQuery.get('q') ?? '');
	let statuses = $state<QuoteStatusType[]>(parseQuoteStatuses(initialQuery.get('status')));
	let sellerId = $state(initialQuery.get('seller') ?? '');
	let preset = $state<SaleDatePreset>(saleListDatePreset(initialFrom, initialTo, new Date()));
	let from = $state(initialFrom);
	let to = $state(initialTo);
	let sort = $state<QuoteListSort>(parseQuoteListSort(initialQuery.get('sort')));
	let per = $state(parseQuoteListPerPage(initialQuery.get('per')));
	let cashea = $state(parseBooleanParam(initialQuery.get('cashea')));
	let currentPage = $state(parsePageParam(initialQuery.get('page')));

	const canAct = $derived(canOperate(data.user.role));

	// ── URL ──────────────────────────────────────────────────────────────────
	function syncUrl(nextPage: number): void {
		replaceUrlSearch(page.url, (params) => {
			setQueryParam(params, 'q', search.trim());
			setQueryParam(params, 'status', serializeQuoteStatuses(statuses));
			setQueryParam(params, 'cashea', cashea ? '1' : null);
			setQueryParam(params, 'seller', sellerId);
			setQueryParam(params, 'from', from);
			setQueryParam(params, 'to', to);
			setQueryParam(params, 'sort', sort === DEFAULT_QUOTE_LIST_SORT ? null : sort);
			setQueryParam(params, 'per', per === DEFAULT_QUOTE_LIST_PER_PAGE ? null : per);
			setQueryParam(params, 'view', view === DEFAULT_SALE_LIST_VIEW ? null : view);
			setQueryParam(params, 'page', nextPage > 1 ? nextPage : null);
		});
	}

	// ── Fetch ────────────────────────────────────────────────────────────────
	async function fetchQuotes(nextPage: number, opts?: { scrollTop?: boolean }): Promise<void> {
		currentPage = nextPage;
		syncUrl(nextPage);
		loading = true;
		const filters = {
			search: search.trim() || undefined,
			statuses: statuses.length > 0 ? statuses : undefined,
			isCashea: cashea || undefined,
			sellerId: sellerId || undefined,
			dateFrom: from ?? undefined,
			dateTo: to ?? undefined
		};
		try {
			const [list, newStats, newFacets] = await Promise.all([
				listQuotes({ ...filters, page: nextPage, perPage: per, sort }),
				getQuoteStats({}),
				getQuoteFacets({ ...filters, page: 1, perPage: 1 })
			]);
			quotesData = list;
			stats = newStats;
			facets = newFacets.counts as unknown as Record<string, number>;
		} catch (e) {
			logger.error('Error cargando presupuestos', e);
			toast.error(getErrorMessage(e, 'Error cargando presupuestos'));
		} finally {
			loading = false;
			// Móvil: al cambiar de página, volver al inicio de la lista (como ventas).
			if (opts?.scrollTop) getAppMainScroll()?.scrollTo({ top: 0 });
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

	function handleToggleCashea(): void {
		cashea = !cashea;
		void fetchQuotes(1);
	}

	function clearFilters(): void {
		search = '';
		statuses = [];
		cashea = false;
		sellerId = '';
		preset = 'all';
		from = null;
		to = null;
		void fetchQuotes(1);
	}

	// ── Chips (una sola fuente de verdad de "filtros activos") ───────────────
	const PRESET_LABELS: Record<SaleDatePreset, string> = {
		...SALE_DATE_PRESET_LABELS,
		custom: 'Rango de fechas'
	};

	const chips = $derived.by(() => {
		const list: SaleFilterChip[] = statuses.map((status) => ({
			id: `status:${status}`,
			label: QUOTE_STATUS_LABELS[status],
			onRemove: () => handleStatusesChange(statuses.filter((s) => s !== status))
		}));
		if (cashea) list.push({ id: 'cashea', label: 'Cashea', onRemove: handleToggleCashea });
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
	function handleKpiSelect(kpi: QuoteListKpi): void {
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

	// ── Vista (preferencia por perfil, compartida con ventas) ────────────────
	function handleViewChange(next: SaleListView): void {
		if (next === view) return;
		view = next;
		syncUrl(currentPage);
		void persistListView(next);
	}

	// ── Navegación / acciones ────────────────────────────────────────────────
	const goQuote = (quote: QuoteWithRelations, suffix = '') =>
		void goto(resolve(`/quotes/${quote.id}${suffix}`));

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

	beforeNavigate(({ to: next }) => {
		const path = next?.url.pathname ?? '';
		if (path !== '/quotes' && path.startsWith('/quotes')) {
			saveReferrerParams('/quotes');
		}
	});

	// UI móvil (hojas): estado dueño de la página; los hijos lo tocan vía handlers.
	let mobileUi = $state<QuoteMobileUi>({
		filtersOpen: false,
		actionsOpen: false,
		actionsQuote: null
	});

	// ── Contexto compartido (escritorio y móvil consumen el mismo estado) ────
	const ctx: QuoteListContext = {
		get quotesData() {
			return quotesData;
		},
		get facets() {
			return facets;
		},
		get stats() {
			return stats;
		},
		sellers,
		get loading() {
			return loading;
		},
		get view() {
			return view;
		},
		get search() {
			return search;
		},
		get statuses() {
			return statuses;
		},
		get sellerId() {
			return sellerId;
		},
		get preset() {
			return preset;
		},
		get from() {
			return from;
		},
		get to() {
			return to;
		},
		get sort() {
			return sort;
		},
		get cashea() {
			return cashea;
		},
		get canAct() {
			return canAct;
		},
		get chips() {
			return chips;
		},
		get mobileUi() {
			return mobileUi;
		},
		handlers: {
			onSearch: handleSearch,
			onStatusesChange: handleStatusesChange,
			onSellerChange: handleSellerChange,
			onPresetChange: handlePresetChange,
			onRangeChange: handleRangeChange,
			onToggleCashea: handleToggleCashea,
			onSortChange: (next) => {
				sort = next;
				void fetchQuotes(1);
			},
			onPerPageChange: (next) => {
				per = next;
				void fetchQuotes(1);
			},
			onKpiSelect: handleKpiSelect,
			onViewChange: handleViewChange,
			onClearFilters: clearFilters,
			onCreate: () => void goto(resolve('/quotes/new')),
			onOpen: (quote) => goQuote(quote),
			onEdit: (quote) => goQuote(quote, '?action=edit'),
			onDuplicate: (quote) => void goto(resolve(`/quotes/new?from=${quote.id}`)),
			onConvert: (quote) => goQuote(quote, '?action=convert'),
			onCancelRequest: handleCancelRequest,
			onPageChange: (next, opts) => void fetchQuotes(next, opts),
			openMobileFilters: () => {
				mobileUi.filtersOpen = true;
			},
			closeMobileFilters: () => {
				mobileUi.filtersOpen = false;
			},
			openMobileActions: (quote) => {
				mobileUi.actionsQuote = quote;
				mobileUi.actionsOpen = true;
			},
			closeMobileActions: () => {
				mobileUi.actionsOpen = false;
				mobileUi.actionsQuote = null;
			}
		}
	};
	setContext(QUOTE_LIST_KEY, ctx);

	// ── Detección de móvil (contenedor <700 px, mismo patrón que ventas) ─────
	// El observer mide el WRAPPER sin padding variable (evita el loop de
	// ResizeObserver). `null` = sin medir: esqueleto neutro, sin flash.
	let pageEl = $state<HTMLElement | undefined>(undefined);
	let isNarrow = $state<boolean | null>(null);

	$effect(() => {
		const target = pageEl;
		if (!target) return;
		const observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width === undefined) return;
			isNarrow = width < 700;
		});
		observer.observe(target);
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>Presupuestos - Optikt</title>
</svelte:head>

<div
	bind:this={pageEl}
	class="animate-rise @container mx-auto w-full max-w-[1280px] min-[1440px]:max-w-[1440px] min-[1920px]:max-w-[1600px] min-[2400px]:max-w-[1920px]"
>
	<div class="flex flex-col gap-3 {isNarrow ? 'px-3 pt-3 pb-24' : 'px-5 pt-3.5 pb-7'}">
		{#if isNarrow === null}
			<SaleListSkeleton />
		{:else if isNarrow}
			<QuoteListMobile />
		{:else}
			<QuoteListDesktop />
		{/if}
	</div>
</div>

<!-- Hojas móviles y FAB: FUERA del contenedor (@container + fixed son incompatibles). -->
{#if isNarrow}
	<QuoteMobileOverlays />
{/if}

<Fab label="Nuevo presupuesto" href="/quotes/new" hidden={isNarrow !== true || !canAct} />

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
