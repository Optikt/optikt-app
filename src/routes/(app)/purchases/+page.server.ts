import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import {
	getAllPurchaseOrders,
	getPurchaseOrderListStats
} from '$lib/server/db/queries/purchaseOrders';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const [initialPurchaseOrders, suppliers, stats] = await Promise.all([
		getAllPurchaseOrders({ limit: 10, orderBy: 'orderDate', orderSort: 'desc' }),
		getAllSuppliers({ includeDeleted: false }),
		getPurchaseOrderListStats()
	]);

	return {
		initialPurchaseOrders,
		totalCount: stats.total,
		suppliers,
		stats
	};
};
