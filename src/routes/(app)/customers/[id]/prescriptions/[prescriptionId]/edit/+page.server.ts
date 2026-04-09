import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { findCustomerById, findPrescriptionById } from '$lib/server/db/queries/customers';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) error(401, 'No autorizado');

	const [customer, prescription] = await Promise.all([
		findCustomerById(params.id),
		findPrescriptionById(params.prescriptionId)
	]);

	if (!customer) error(404, 'Cliente no encontrado');
	if (!prescription || prescription.customerId !== customer.id) {
		error(404, 'Fórmula no encontrada');
	}

	return { customer, prescription };
};
