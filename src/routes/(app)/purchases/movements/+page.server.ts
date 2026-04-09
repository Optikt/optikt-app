import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getMovementsWithDetails,
	countInventoryMovements
} from '$lib/server/db/queries/inventoryMovements';
import { daysAgo, nowUTC, toISODate } from '$lib/dates';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

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
