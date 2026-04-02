import type { PageServerLoad } from './$types';
import { getDashboardStats, getRecentSales, getLowStockItems } from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	const [stats, recentSales, lowStockItems] = await Promise.all([
		getDashboardStats(),
		getRecentSales(5),
		getLowStockItems(10)
	]);

	return { stats, recentSales, lowStockItems };
};
