import type { PageServerLoad } from './$types';
import { getReportSales } from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	// Default: current month
	const now = new Date();
	const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
	const dateTo = now;

	const { sales, summary } = await getReportSales(dateFrom, dateTo);

	return { sales, summary, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
};
