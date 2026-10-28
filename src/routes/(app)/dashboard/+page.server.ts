import type { PageServerLoad } from './$types';
import {
	getDashboardStats,
	getRecentSales,
	getLowStockItems,
	getPendingFreeItemSales
} from '#lib/server/db/queries/index.js';
import { getUpcomingPurchaseOrderDues } from '#lib/server/db/queries/purchaseOrderCreditSchedule.js';
import { daysAgo, daysFromNow, toISODate } from '#lib/dates.js';
import { isAdminRole } from '#lib/shared/enums/index.js';

export const load: PageServerLoad = async ({ locals }) => {
	const canSeePurchaseDue = isAdminRole(locals.user?.role);
	const [stats, recentSales, lowStockItems, pendingFreeItemSales, upcomingPurchaseDues] =
		await Promise.all([
			getDashboardStats(),
			getRecentSales(5),
			getLowStockItems(10),
			getPendingFreeItemSales(20),
			canSeePurchaseDue
				? getUpcomingPurchaseOrderDues(toISODate(daysAgo(60)), toISODate(daysFromNow(30)))
				: Promise.resolve([])
		]);

	return { stats, recentSales, lowStockItems, pendingFreeItemSales, upcomingPurchaseDues };
};
