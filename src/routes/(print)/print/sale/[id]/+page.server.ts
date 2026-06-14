import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSettings } from '$lib/server/db/queries/settings';
import { SaleStatus } from '$lib/shared/enums';
import {
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments
} from '$lib/server/db/queries/sales';
import { getExchangeRateValue } from '$lib/server/exchangeRates/service';

// TODO: Verify if we should load the BCV rate value of Sale date, or by
// payment or we do not need it at all
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const sale = await findSaleByIdWithRelations(params.id);
	if (!sale) {
		error(404, 'Venta no encontrada');
	}

	if (sale.status === SaleStatus.CANCELLED) {
		error(409, 'No se puede imprimir una venta cancelada');
	}

	const [items, payments, settings, bcvRate] = await Promise.all([
		getSaleItemsWithDetails(params.id),
		getSalePayments(params.id),
		getSettings(),
		getExchangeRateValue('USD')
	]);

	return {
		bcvRate: bcvRate ?? null,
		items,
		payments,
		sale,
		settings
	};
};
