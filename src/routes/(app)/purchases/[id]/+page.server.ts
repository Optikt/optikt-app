import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	findPurchaseOrderByIdWithRelations,
	getPurchaseOrderItems
} from '$lib/server/db/queries/purchaseOrders';
import { getMovementsByReference } from '$lib/server/db/queries/inventoryMovements';
import { findLotById } from '$lib/server/db/queries/inventoryLots';
import { MovementReferenceType } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const purchaseOrder = await findPurchaseOrderByIdWithRelations(params.id);
	if (!purchaseOrder) {
		error(404, 'Orden de compra no encontrada');
	}

	const [items, movements] = await Promise.all([
		getPurchaseOrderItems(params.id),
		getMovementsByReference(MovementReferenceType.PURCHASE_ORDER, params.id)
	]);

	// Load lots for items that have been confirmed (have lotId)
	const lotIds = items.map((i) => i.lotId).filter(Boolean) as string[];
	const lots = await Promise.all(lotIds.map((id) => findLotById(id)));
	const lotsMap = Object.fromEntries(lots.filter(Boolean).map((l) => [l!.id, l!]));

	return {
		purchaseOrder,
		items,
		movements,
		lotsMap
	};
};
