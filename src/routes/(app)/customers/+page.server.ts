import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllCustomers } from '$lib/server/db/queries/customers';
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { isNull, count } from 'drizzle-orm';

/**
 * Load initial customers data for SSR
 * Only handles initial page load - filtering/pagination uses remote functions
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	// Get count
	const [countResult] = await db
		.select({ count: count() })
		.from(customers)
		.where(isNull(customers.deletedAt));

	// Get first page of customers
	const customerList = await getAllCustomers({
		orderBy: 'createdAt',
		orderSort: 'desc',
		limit: 10
	});

	return {
		initialCustomers: customerList,
		totalCount: countResult?.count ?? 0
	};
};
