import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { findCustomerById, getCustomerPrescriptions } from '$lib/server/db/queries/customers';

/**
 * Load customer detail with prescriptions
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const customer = await findCustomerById(params.id);
	if (!customer) {
		error(404, 'Cliente no encontrado');
	}

	// Get prescriptions for this customer
	const prescriptions = await getCustomerPrescriptions(params.id);

	return {
		customer,
		prescriptions
	};
};
