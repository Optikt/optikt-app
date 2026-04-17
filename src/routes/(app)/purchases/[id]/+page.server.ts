import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	findPurchaseOrderByIdWithRelations,
	getPurchaseOrderItems
} from '$lib/server/db/queries/purchaseOrders';
import { getPurchaseOrderRelatedMovements } from '$lib/server/db/queries/inventoryMovements';
import { findLotById } from '$lib/server/db/queries/inventoryLots';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const purchaseOrder = await findPurchaseOrderByIdWithRelations(params.id);
	if (!purchaseOrder) {
		error(404, 'Orden de compra no encontrada');
	}

	const items = await getPurchaseOrderItems(params.id);

	// Load lots for items that have been confirmed (have lotId)
	const lotIds = items.map((item) => item.lotId).filter(Boolean) as string[];
	const [movements, lots] = await Promise.all([
		getPurchaseOrderRelatedMovements(params.id, lotIds),
		Promise.all(lotIds.map((id) => findLotById(id)))
	]);
	const lotsMap = Object.fromEntries(lots.filter(Boolean).map((l) => [l!.id, l!]));

	return {
		purchaseOrder,
		items,
		movements,
		lotsMap
	};
};
