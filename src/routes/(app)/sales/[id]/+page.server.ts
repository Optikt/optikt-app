import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSaleItemsWithDetails } from '$lib/server/db/queries/sales/items';
import { getSalePayments } from '$lib/server/db/queries/sales/payments';
import { findSaleByIdWithRelations } from '$lib/server/db/queries/sales/reads';
import { getEntityHistory } from '$lib/server/db/queries/changeHistory';
import { getMovementsWithDetails } from '$lib/server/db/queries/inventoryMovements';
import { getAllSuppliers, getAllTreatments } from '$lib/server/db/queries/suppliers';
import { MovementReferenceType } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const sale = await findSaleByIdWithRelations(params.id);
	if (!sale) {
		error(404, 'Venta no encontrada');
	}

	const [items, payments, movements, supplierList, allTreatments, auditHistory] = await Promise.all(
		[
			getSaleItemsWithDetails(params.id),
			getSalePayments(params.id, { includeVoided: true }),
			getMovementsWithDetails({
				referenceType: MovementReferenceType.SALE,
				referenceId: params.id,
				orderSort: 'asc'
			}),
			getAllSuppliers({ orderBy: 'name' }),
			getAllTreatments(),
			getEntityHistory('sale', params.id)
		]
	);

	return {
		sale,
		items,
		payments,
		movements,
		suppliers: supplierList,
		allTreatments,
		auditHistory
	};
};
