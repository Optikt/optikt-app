import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { requirePageRole } from '$lib/server/guards';
import { UserRole, PurchaseOrderStatus } from '$lib/shared/enums';
import {
	findPurchaseOrderByIdWithRelations,
	getPurchaseOrderItems
} from '$lib/server/db/queries/purchaseOrders';
import { getPurchaseOrderCreditSchedule } from '$lib/server/db/queries/purchaseOrderCreditSchedule';
import { getLensCatalogItemsWithRelations } from '$lib/server/db/queries/lenses';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';

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

	const [items, creditSchedule, suppliers, products, lensItems] = await Promise.all([
		getPurchaseOrderItems(params.id),
		getPurchaseOrderCreditSchedule(params.id),
		getAllSuppliers({ includeDeleted: false }),
		getAllProductsWithRelations({ includeInactive: true, limit: 500 }),
		getLensCatalogItemsWithRelations()
	]);

	return {
		purchaseOrder,
		items,
		creditSchedule,
		suppliers,
		products,
		lensItems
	};
};
