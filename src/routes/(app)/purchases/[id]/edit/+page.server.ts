import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { requirePageRole } from '$lib/server/guards';
import { UserRole, PurchaseOrderStatus } from '$lib/shared/enums';
import {
	findPurchaseOrderByIdWithRelations,
	getPurchaseOrderItems
} from '$lib/server/db/queries/purchaseOrders';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const purchaseOrder = await findPurchaseOrderByIdWithRelations(params.id);
	if (!purchaseOrder) {
		error(404, 'Orden de compra no encontrada');
	}

	if (purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
		redirect(303, `/purchases/${params.id}`);
	}

	if (purchaseOrder.isReadyForReview) {
		redirect(303, `/purchases/${params.id}`);
	}

	const [items, suppliers] = await Promise.all([
		getPurchaseOrderItems(params.id),
		getAllSuppliers({ includeDeleted: false })
	]);

	return {
		purchaseOrder,
		items,
		suppliers
	};
};
