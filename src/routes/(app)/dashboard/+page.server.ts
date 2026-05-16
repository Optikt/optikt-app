import type { PageServerLoad } from './$types';
import {
	getDashboardStats,
	getRecentSales,
	getLowStockItems,
	getPendingFreeItemSales
} from '$lib/server/db/queries';
import { getUpcomingPurchaseOrderDues } from '$lib/server/db/queries/purchaseOrderCreditSchedule';
import { daysAgo, daysFromNow, toISODate } from '$lib/dates';
import { isAdminRole } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals }) => {
	const canSeePurchaseDue = isAdminRole(locals.user?.role);
	const [stats, recentSales, lowStockItems, pendingFreeItemSales, upcomingPurchaseDues] =
		await Promise.all([
			getDashboardStats(),
			getRecentSales(5),
			getLowStockItems(10),
			getPendingFreeItemSales(20),
			canSeePurchaseDue
				? getUpcomingPurchaseOrderDues(
						toISODate(daysAgo(60)),
						toISODate(daysFromNow(30))
					)
				: Promise.resolve([])
		]);

	return { stats, recentSales, lowStockItems, pendingFreeItemSales, upcomingPurchaseDues };
};
