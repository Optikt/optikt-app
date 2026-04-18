import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getAllPurchaseOrders,
	getPurchaseOrderListStats
} from '$lib/server/db/queries/purchaseOrders';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

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
