import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getReportPayments } from '$lib/server/db/queries';
import { monthStart, nowUTC, toISODate } from '$lib/dates';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);
	// Default: current month
	const dateFrom = toISODate(monthStart());
	const dateTo = toISODate(nowUTC());

	const { payments, refunds, summary } = await getReportPayments(dateFrom, dateTo);

	return {
		payments,
		refunds,
		summary,
		dateFrom,
		dateTo
	};
};
