import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getMovementsWithDetails,
	countInventoryMovements
} from '$lib/server/db/queries/inventoryMovements';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const productId = url.searchParams.get('productId') || undefined;

	// Default to last 30 days
	const now = new Date();
	const thirtyDaysAgo = new Date(now);
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const defaultDateFrom = thirtyDaysAgo.toISOString().slice(0, 10);
	const defaultDateTo = now.toISOString().slice(0, 10);

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
