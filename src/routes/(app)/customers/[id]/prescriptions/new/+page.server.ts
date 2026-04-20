import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { findCustomerById } from '$lib/server/db/queries/customers';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const customer = await findCustomerById(params.id);
	if (!customer) error(404, 'Cliente no encontrado');

	return { customer };
};
