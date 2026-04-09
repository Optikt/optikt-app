import type { PageServerLoad } from './$types';
import { monthStart, toUTCString } from '$lib/dates';
import { getAllSales, countSales, getSalesStats } from '$lib/server/db/queries/sales';

export const load: PageServerLoad = async () => {
	const [initialSales, totalCount, stats] = await Promise.all([
		getAllSales({ limit: 10 }),
		countSales(),
		getSalesStats(toUTCString(monthStart()))
	]);

	return {
		initialSales,
		totalCount,
		stats
	};
};
