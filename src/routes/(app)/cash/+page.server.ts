import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { monthStart, nowUTC, toEndOfDay, toISODate, toUTCString } from '$lib/dates';
import { getCashReport } from '$lib/server/db/queries/cash/report';
import { getDailyBreakdown } from '$lib/server/db/queries/cash/daily';
import { getPipeline } from '$lib/server/db/queries/cash/pipeline';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const dateFrom = toISODate(monthStart());
	const dateTo = toISODate(nowUTC());

	const fromTs = toUTCString(monthStart());
	const toTs = toUTCString(toEndOfDay(nowUTC()));

	const [report, daily, pipeline] = await Promise.all([
		getCashReport({ from: fromTs, to: toTs }),
		getDailyBreakdown({ from: fromTs, to: toTs }),
		getPipeline()
	]);

	return { report, daily, pipeline, dateFrom, dateTo };
};
