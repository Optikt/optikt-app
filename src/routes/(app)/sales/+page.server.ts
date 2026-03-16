import type { PageServerLoad } from './$types';
import { getAllSales, countSales } from '$lib/server/db/queries/sales';

export const load: PageServerLoad = async () => {
	const [initialSales, totalCount] = await Promise.all([getAllSales({ limit: 10 }), countSales()]);

	return {
		initialSales,
		totalCount
	};
};
