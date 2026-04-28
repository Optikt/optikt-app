import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fromISO, toISODate } from '$lib/dates';
import { getRatesForDate } from '$lib/server/db/queries/exchangeRates';
import { getSettings } from '$lib/server/db/queries/settings';
import {
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments
} from '$lib/server/db/queries/sales';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const sale = await findSaleByIdWithRelations(params.id);
	if (!sale) {
		error(404, 'Venta no encontrada');
	}

	const saleDateKey = toISODate(fromISO(sale.saleDate));
	const [items, payments, settings, ratesForSaleDate] = await Promise.all([
		getSaleItemsWithDetails(params.id),
		getSalePayments(params.id),
		getSettings(),
		getRatesForDate(saleDateKey)
	]);

	const bcvRate = ratesForSaleDate.find((rate) => rate.currency.code === 'USD')?.rateToVes ?? null;

	return {
		bcvRate,
		items,
		payments,
		sale,
		settings
	};
};