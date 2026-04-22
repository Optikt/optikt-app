import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { findCustomerById, findPrescriptionById } from '$lib/server/db/queries/customers';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

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
