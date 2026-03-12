import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments
} from '$lib/server/db/queries/sales';
import { getLatestRates } from '$lib/server/db/queries/exchangeRates';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const sale = await findSaleByIdWithRelations(params.id);
	if (!sale) {
		error(404, 'Venta no encontrada');
	}

	const [items, payments, latestRates] = await Promise.all([
		getSaleItemsWithDetails(params.id),
		getSalePayments(params.id, { includeVoided: true }),
		getLatestRates()
	]);

	// TODO - FIXME - This is a temporary solution to get the BCV rate for the sale's date. 
	// We should ideally store the BCV rate used for each sale in the database to avoid 
	// issues with historical rates changing over time. For now, we will just use the latest
	// rate, which is not ideal but should work for most cases since BCV rates don't change
	// frequently.
	
	// Extract BCV rate from latest rates (currency code 'USD' with source 'BCV')
	const bcvRateEntry = latestRates.find((r) => r.currency.code === 'USD');
	const bcvRate = bcvRateEntry?.rateToVes ?? 0;

	return {
		sale,
		items,
		payments,
		bcvRate
	};
};
