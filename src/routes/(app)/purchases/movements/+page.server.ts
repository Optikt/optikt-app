import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import {
	getMovementsWithDetails,
	countInventoryMovements
} from '#lib/server/db/queries/inventoryMovements.js';
import { daysAgo, nowUTC, toISODate } from '#lib/dates.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const productId = url.searchParams.get('productId') || undefined;

	// Default to last 30 days
	const defaultDateFrom = toISODate(daysAgo(30));
	const defaultDateTo = toISODate(nowUTC());

	const filterOptions = {
		productId,
		dateFrom: defaultDateFrom,
		dateTo: defaultDateTo
	};

	const [initialMovements, totalCount] = await Promise.all([
		getMovementsWithDetails({ ...filterOptions, limit: 20 }),
		countInventoryMovements(filterOptions)
	]);

	return {
		initialMovements,
		totalCount,
		productId,
		defaultDateFrom,
		defaultDateTo
	};
};
