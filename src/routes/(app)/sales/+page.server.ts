import type { PageServerLoad } from './$types';
import { monthStart, toUTCString } from '$lib/dates';
import { getAllSales, countSales, getSalesStats } from '$lib/server/db/queries/sales';
import { ALL_SALE_STATUSES, type SaleStatus } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ url }) => {
	const searchParams = url.searchParams;
	const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
	const perPage = 10;
	const search = searchParams.get('q')?.trim() || undefined;
	const rawStatus = searchParams.get('status');
	const status =
		rawStatus && ALL_SALE_STATUSES.includes(rawStatus as SaleStatus)
			? (rawStatus as SaleStatus)
			: undefined;
	const shippingCostPending = searchParams.get('shippingPending') === '1' ? true : undefined;
	const hasFreeItem = searchParams.get('freeItem') === '1' ? true : undefined;
	const offset = (page - 1) * perPage;

	const [initialSales, totalCount, stats] = await Promise.all([
		getAllSales({
			limit: perPage,
			offset,
			search,
			status,
			shippingCostPending,
			hasFreeItem
		}),
		countSales({ search, status, shippingCostPending, hasFreeItem }),
		getSalesStats(toUTCString(monthStart()))
	]);

	return {
		initialSales,
		totalCount,
		stats
	};
};
