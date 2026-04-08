import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { findCustomerById, getCustomerPrescriptions } from '$lib/server/db/queries/customers';
import { getAllSales } from '$lib/server/db/queries/sales';

/**
 * Load customer detail with prescriptions and recent sales
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const customer = await findCustomerById(params.id);
	if (!customer) {
		error(404, 'Cliente no encontrado');
	}

	const [prescriptions, recentSales] = await Promise.all([
		getCustomerPrescriptions(params.id),
		getAllSales({ customerId: params.id, limit: 3 })
	]);

	return {
		customer,
		prescriptions,
		recentSales
	};
};
