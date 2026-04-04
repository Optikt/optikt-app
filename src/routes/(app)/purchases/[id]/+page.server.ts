import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	findPurchaseOrderByIdWithRelations,
	getPurchaseOrderItems
} from '$lib/server/db/queries/purchaseOrders';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const purchaseOrder = await findPurchaseOrderByIdWithRelations(params.id);
	if (!purchaseOrder) {
		error(404, 'Orden de compra no encontrada');
	}

	const items = await getPurchaseOrderItems(params.id);

	return {
		purchaseOrder,
		items
	};
};
