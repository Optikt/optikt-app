import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllPurchaseOrders, countPurchaseOrders } from '$lib/server/db/queries/purchaseOrders';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const [initialPurchaseOrders, totalCount, suppliers] = await Promise.all([
		getAllPurchaseOrders({ limit: 10, orderBy: 'orderDate', orderSort: 'desc' }),
		countPurchaseOrders(),
		getAllSuppliers({ includeDeleted: false })
	]);

	return {
		initialPurchaseOrders,
		totalCount,
		suppliers
	};
};
