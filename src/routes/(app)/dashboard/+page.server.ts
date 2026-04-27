import type { PageServerLoad } from './$types';
import {
	getDashboardStats,
	getRecentSales,
	getLowStockItems,
	getPendingFreeItemSales
} from '$lib/server/db/queries';

export const load: PageServerLoad = async () => {
	const [stats, recentSales, lowStockItems, pendingFreeItemSales] = await Promise.all([
		getDashboardStats(),
		getRecentSales(5),
		getLowStockItems(10),
		getPendingFreeItemSales(20)
	]);

	return { stats, recentSales, lowStockItems, pendingFreeItemSales };
};
