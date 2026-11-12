import type { PageServerLoad } from './$types';
import { z } from 'zod';
import { monthStart, toUTCString } from '$lib/dates';
import { parseBooleanParam, parsePageParam } from '$lib/utils';
import {
	getSalesListPage,
	getSalesStats,
	listSaleSellers
} from '$lib/server/db/queries/sales/reads';
import { getUserPreference } from '$lib/server/db/queries/userPreferences';
import { parseSaleStatuses } from '$lib/components/sales/statusFilter';
import {
	parseIsoDateOnly,
	parseSaleListPerPage,
	parseSaleListSort,
	parseSaleListView,
	saleListSortToOrder
} from '$lib/components/sales/listParams';

export const load: PageServerLoad = async ({ url, locals }) => {
	const searchParams = url.searchParams;

	const page = parsePageParam(searchParams.get('page'));
	const perPage = parseSaleListPerPage(searchParams.get('per'));
	const search = searchParams.get('q')?.trim() || undefined;

	const statuses = parseSaleStatuses(searchParams.get('status'));

	// Params no validados por Zod en el load: acá también son confianza del cliente.
	const sellerRaw = searchParams.get('seller');
	const sellerId = sellerRaw && z.uuid().safeParse(sellerRaw).success ? sellerRaw : undefined;
	const dateFrom = parseIsoDateOnly(searchParams.get('from')) ?? undefined;
	const dateTo = parseIsoDateOnly(searchParams.get('to')) ?? undefined;

	const order = saleListSortToOrder(parseSaleListSort(searchParams.get('sort')));

	const filterOptions = {
		statuses: statuses.length > 0 ? statuses : undefined,
		search,
		sellerId,
		dateFrom,
		dateTo,
		shippingCostPending: parseBooleanParam(searchParams.get('shippingPending')) || undefined,
		hasFreeItem: parseBooleanParam(searchParams.get('freeItem')) || undefined,
		isCashea: parseBooleanParam(searchParams.get('cashea')) || undefined,
		balanceOnly: parseBooleanParam(searchParams.get('balance')) || undefined
	};

	const [list, stats, sellers, rawView] = await Promise.all([
		getSalesListPage({
			...filterOptions,
			...order,
			limit: perPage,
			offset: (page - 1) * perPage
		}),
		getSalesStats(toUTCString(monthStart())),
		listSaleSellers(),
		locals.user ? getUserPreference(locals.user.id, 'sales.view') : Promise.resolve(null)
	]);

	return {
		...list,
		page,
		perPage,
		totalPages: Math.ceil(list.total / perPage),
		stats,
		sellers,
		/** Preferencia guardada del usuario (`?view=` de la URL tiene prioridad en la página). */
		preferredView: parseSaleListView(typeof rawView === 'string' ? rawView : null)
	};
};
