import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { monthStart, nowUTC, toEndOfDay, toISODate, toUTCString } from '#lib/dates.js';
import { getCashReport } from '#lib/server/db/queries/cash/report.js';
import { getDailyBreakdown } from '#lib/server/db/queries/cash/daily.js';
import { getPipeline } from '#lib/server/db/queries/cash/pipeline.js';

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
