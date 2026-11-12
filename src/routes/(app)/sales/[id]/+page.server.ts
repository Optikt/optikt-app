import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSaleItemsWithDetails } from '$lib/server/db/queries/sales/items';
import { getSalePayments } from '$lib/server/db/queries/sales/payments';
import { findSaleByIdWithRelations } from '$lib/server/db/queries/sales/reads';
import { getEntityHistory } from '$lib/server/db/queries/changeHistory';
import { getMovementsWithDetails } from '$lib/server/db/queries/inventoryMovements';
import { getAllSuppliers, getAllTreatments } from '$lib/server/db/queries/suppliers';
import { getSalePrescription } from '$lib/server/db/queries/sales/reads';
import { findLensCatalogItemByIdWithRelations } from '$lib/server/db/queries/lenses/catalog';
import { MovementReferenceType, SaleItemType } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const sale = await findSaleByIdWithRelations(params.id);
	if (!sale) {
		error(404, 'Venta no encontrada');
	}

	const [items, payments, movements, supplierList, allTreatments, auditHistory, prescription] =
		await Promise.all([
			getSaleItemsWithDetails(params.id),
			getSalePayments(params.id, { includeVoided: true }),
			getMovementsWithDetails({
				referenceType: MovementReferenceType.SALE,
				referenceId: params.id,
				orderSort: 'asc'
			}),
			getAllSuppliers({ orderBy: 'name' }),
			getAllTreatments(),
			getEntityHistory('sale', params.id),
			getSalePrescription(params.id)
		]);

	/** Lens catalog entries for the sale's crystals: factory treatments in the item meta (drawer parity). */
	const lensIds = [
		...new Set(
			items
				.filter((i) => i.itemType === SaleItemType.LENS_PAIR && i.lensCatalogItemId)
				.map((i) => i.lensCatalogItemId as string)
		)
	];
	const lensCatalogItems = (
		await Promise.all(lensIds.map((id) => findLensCatalogItemByIdWithRelations(id)))
	).filter((l) => l !== null);

	return {
		sale,
		items,
		payments,
		movements,
		suppliers: supplierList,
		allTreatments,
		auditHistory,
		prescription,
		lensCatalogItems
	};
};
