import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { findCustomerById } from '#lib/server/db/queries/customers.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const customer = await findCustomerById(params.id);
	if (!customer) error(404, 'Cliente no encontrado');

	return { customer };
};
