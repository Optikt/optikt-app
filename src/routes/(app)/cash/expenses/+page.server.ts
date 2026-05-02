import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { monthStart, nowUTC, toEndOfDay, toISODate, toUTCString } from '$lib/dates';
import { listExpenses } from '$lib/server/db/queries/cash';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const dateFrom = toISODate(monthStart());
	const dateTo = toISODate(nowUTC());
	const fromTs = toUTCString(monthStart());
	const toTs = toUTCString(toEndOfDay(nowUTC()));

	const expenses = await listExpenses({ from: fromTs, to: toTs, includeVoided: false });

	return { expenses, dateFrom, dateTo };
};
