import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import {
	getAllQuotes,
	countQuotes,
	countQuotesByStatus,
	sumQuotesForSelection,
	getQuoteStats,
	listQuoteSellers
} from '$lib/server/db/queries/quotes/list';
import { monthStart, toUTCString } from '$lib/dates';
import {
	parseIsoDateOnly,
	parseQuoteListSort,
	parseQuoteStatuses,
	quoteListSortToOrder,
	DEFAULT_QUOTE_LIST_PER_PAGE
} from '$lib/components/quotes/list/quoteListParams';

/** Página del listado de presupuestos — misma estructura que /sales (KPIs, facetas, selección). */
export const load: PageServerLoad = async ({ url, locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const searchParams = url.searchParams;
	const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
	const rawPer = Number.parseInt(searchParams.get('per') ?? '', 10);
	const perPage = [10, 25, 50].includes(rawPer) ? rawPer : DEFAULT_QUOTE_LIST_PER_PAGE;

	const search = searchParams.get('q')?.trim() || undefined;
	const statuses = parseQuoteStatuses(searchParams.get('status'));
	const sellerId = searchParams.get('seller') || undefined;
	const dateFrom = parseIsoDateOnly(searchParams.get('from')) ?? undefined;
	const dateTo = parseIsoDateOnly(searchParams.get('to')) ?? undefined;
	const { orderBy, orderSort } = quoteListSortToOrder(parseQuoteListSort(searchParams.get('sort')));

	const filters = {
		statuses: statuses.length > 0 ? statuses : undefined,
		sellerId,
		dateFrom,
		dateTo,
		search
	};

	const [quotes, total, facets, selection, stats, sellers] = await Promise.all([
		getAllQuotes({
			...filters,
			orderBy,
			orderSort,
			limit: perPage,
			offset: (page - 1) * perPage
		}),
		countQuotes(filters),
		countQuotesByStatus(filters),
		sumQuotesForSelection(filters),
		getQuoteStats(toUTCString(monthStart())),
		listQuoteSellers()
	]);

	return {
		quotes,
		total,
		facets,
		selection,
		stats,
		sellers,
		page,
		perPage,
		totalPages: Math.max(1, Math.ceil(total / perPage))
	};
};
