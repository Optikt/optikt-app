import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { findCustomerById, getCustomerPrescriptions } from '$lib/server/db/queries/customers';
import { getCustomerHistory } from '$lib/server/db/queries/customerHistory';

/**
 * Load customer detail with prescriptions, sales, quotes, and payments
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const customer = await findCustomerById(params.id);
	if (!customer) {
		error(404, 'Cliente no encontrado');
	}

	const [prescriptions, history] = await Promise.all([
		getCustomerPrescriptions(params.id),
		getCustomerHistory(params.id)
	]);

	return {
		customer,
		prescriptions,
		customerSales: history.sales,
		customerQuotes: history.quotes
	};
};
