import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { findCustomerById } from '$lib/server/db/queries/customers';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) error(401, 'No autorizado');

	const customer = await findCustomerById(params.id);
	if (!customer) error(404, 'Cliente no encontrado');

	return { customer };
};
