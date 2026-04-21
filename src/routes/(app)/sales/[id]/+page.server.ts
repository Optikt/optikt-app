import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments
} from '$lib/server/db/queries/sales';
import { getLatestRates } from '$lib/server/db/queries/exchangeRates';
import { getMovementsWithDetails } from '$lib/server/db/queries/inventoryMovements';
import { MovementReferenceType } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const sale = await findSaleByIdWithRelations(params.id);
	if (!sale) {
		error(404, 'Venta no encontrada');
	}

	const [items, payments, latestRates, movements] = await Promise.all([
		getSaleItemsWithDetails(params.id),
		getSalePayments(params.id, { includeVoided: true }),
		getLatestRates(),
		getMovementsWithDetails({
			referenceType: MovementReferenceType.SALE,
			referenceId: params.id,
			orderSort: 'asc'
		})
	]);

	const bcvRateEntry = latestRates.find((r) => r.currency.code === 'USD');
	const bcvRate = bcvRateEntry?.rateToVes ?? 0;

	return {
		sale,
		items,
		payments,
		bcvRate,
		movements
	};
};
