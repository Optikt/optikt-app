import type { PageServerLoad } from './$types';
import { getReportSales } from '$lib/server/db/queries';
import { monthStart, nowUTC, toISODate } from '$lib/dates';

export const load: PageServerLoad = async () => {
	// Default: current month
	const dateFrom = toISODate(monthStart());
	const dateTo = toISODate(nowUTC());

	const { sales, summary } = await getReportSales(dateFrom, dateTo);

	return { sales, summary, dateFrom, dateTo };
};
