import type { PageServerLoad } from './$types';
import { getReportPayments } from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	// Default: current month
	const now = new Date();
	const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
	const dateTo = now;

	const { payments, summary } = await getReportPayments(dateFrom, dateTo);

	return { payments, summary, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
};
