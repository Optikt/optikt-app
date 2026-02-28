import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { db } from '$lib/server/db';
import { suppliers } from '$lib/server/db/schema';
import { isNull, count } from 'drizzle-orm';

/**
 * Load initial suppliers data for SSR
 * Only handles initial page load - filtering/pagination uses remote functions
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	// Get count
	const [countResult] = await db
		.select({ count: count() })
		.from(suppliers)
		.where(isNull(suppliers.deletedAt));

	// Get first page of suppliers
	const supplierList = await getAllSuppliers({
		orderBy: 'createdAt',
		orderSort: 'desc',
		limit: 10
	});

	return {
		initialSuppliers: supplierList,
		totalCount: countResult?.count ?? 0
	};
};
