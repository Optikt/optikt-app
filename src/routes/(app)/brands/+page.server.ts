import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { brands } from '$lib/server/db/schema';
import { isNull, count } from 'drizzle-orm';
import { getAllBrands } from '$lib/server/db/queries/brands';

/**
 * Load initial brands data for SSR
 * Only handles initial page load - filtering/pagination uses remote functions
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	// Get count
	const [countResult] = await db
		.select({ count: count() })
		.from(brands)
		.where(isNull(brands.deletedAt));

	// Get first page of brands
	const brandList = await getAllBrands({ orderBy: 'createdAt', orderSort: 'desc', limit: 10 });

	return {
		initialBrands: brandList,
		totalCount: countResult?.count ?? 0
	};
};
