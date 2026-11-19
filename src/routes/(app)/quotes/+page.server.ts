import type { PageServerLoad } from './$types';
import { z } from 'zod';
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
import { getUserPreference } from '$lib/server/db/queries/userPreferences';
import { monthStart, toUTCString } from '$lib/dates';
import { parseBooleanParam, parsePageParam } from '$lib/utils/urlState';
import { LIST_VIEW_PREFERENCE_KEY, parseSaleListView } from '$lib/components/sales/listParams';
import {
	parseIsoDateOnly,
	parseQuoteListPerPage,
	parseQuoteListSort,
	parseQuoteStatuses,
	quoteListSortToOrder
} from '$lib/components/quotes/list/quoteListParams';

/** Página del listado de presupuestos — misma estructura que /sales (KPIs, facetas, selección). */
export const load: PageServerLoad = async ({ url, locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const searchParams = url.searchParams;
	const page = parsePageParam(searchParams.get('page'));
	const perPage = parseQuoteListPerPage(searchParams.get('per'));

	const search = searchParams.get('q')?.trim() || undefined;
	const statuses = parseQuoteStatuses(searchParams.get('status'));
	// Params no validados por Zod en el load: un seller inválido no debe romper la query.
	const sellerRaw = searchParams.get('seller');
	const sellerId = sellerRaw && z.uuid().safeParse(sellerRaw).success ? sellerRaw : undefined;
	const dateFrom = parseIsoDateOnly(searchParams.get('from')) ?? undefined;
	const dateTo = parseIsoDateOnly(searchParams.get('to')) ?? undefined;
	const { orderBy, orderSort } = quoteListSortToOrder(parseQuoteListSort(searchParams.get('sort')));

	const filters = {
		statuses: statuses.length > 0 ? statuses : undefined,
		sellerId,
		dateFrom,
		dateTo,
		search,
		isCashea: parseBooleanParam(searchParams.get('cashea')) || undefined
	};

	const [quotes, total, facets, selection, stats, sellers, rawView] = await Promise.all([
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
		listQuoteSellers(),
		// Misma preferencia que ventas: la vista Lista/Cuadros es una sola por perfil.
		locals.user
			? getUserPreference(locals.user.id, LIST_VIEW_PREFERENCE_KEY)
			: Promise.resolve(null)
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
		totalPages: Math.max(1, Math.ceil(total / perPage)),
		/** Preferencia guardada (`?view=` de la URL tiene prioridad en la página). */
		preferredView: parseSaleListView(typeof rawView === 'string' ? rawView : null)
	};
};
