import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllMaterials, countMaterials } from '$lib/server/db/queries/materials';

/**
 * Load initial materials data for SSR
 * Only handles initial page load - filtering/pagination uses remote functions
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const [materialList, totalCount] = await Promise.all([
		getAllMaterials({ limit: 10, orderBy: 'createdAt', orderSort: 'desc' }),
		countMaterials()
	]);

	return {
		initialMaterials: materialList,
		totalCount
	};
};
