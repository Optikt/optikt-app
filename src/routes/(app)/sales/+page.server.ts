import type { PageServerLoad } from './$types';
import { monthStart, toUTCString } from '$lib/dates';
import { getAllSales, countSales, getSalesStats } from '$lib/server/db/queries/sales/reads';
import { parseSaleStatuses } from '$lib/components/sales/statusFilter';

export const load: PageServerLoad = async ({ url }) => {
	const searchParams = url.searchParams;
	const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
	const perPage = 10;
	const search = searchParams.get('q')?.trim() || undefined;
	const statuses = parseSaleStatuses(searchParams.get('status'));
	const statusFilter = statuses.length > 0 ? statuses : undefined;
	const shippingCostPending = searchParams.get('shippingPending') === '1' ? true : undefined;
	const hasFreeItem = searchParams.get('freeItem') === '1' ? true : undefined;
	const offset = (page - 1) * perPage;

	const [initialSales, totalCount, stats] = await Promise.all([
		getAllSales({
			limit: perPage,
			offset,
			search,
			statuses: statusFilter,
			shippingCostPending,
			hasFreeItem
		}),
		countSales({ search, statuses: statusFilter, shippingCostPending, hasFreeItem }),
		getSalesStats(toUTCString(monthStart()))
	]);

	return {
		initialSales,
		totalCount,
		stats
	};
};
