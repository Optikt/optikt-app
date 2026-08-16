import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments
} from '$lib/server/db/queries/sales';
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

	const [items, payments, movements, supplierList, allTreatments] = await Promise.all([
		getSaleItemsWithDetails(params.id),
		getSalePayments(params.id, { includeVoided: true }),
		getMovementsWithDetails({
			referenceType: MovementReferenceType.SALE,
			referenceId: params.id,
			orderSort: 'asc'
		}),
		getAllSuppliers({ orderBy: 'name' }),
		getAllTreatments()
	]);

	return {
		sale,
		items,
		payments,
		movements,
		suppliers: supplierList,
		allTreatments
	};
};
