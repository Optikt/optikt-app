import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getNextOrderNumber } from '$lib/server/db/queries/sales';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const [nextOrderNumber, suppliers] = await Promise.all([
		getNextOrderNumber(),
		getAllSuppliers({ orderBy: 'name' })
	]);

	return {
		suppliers,
		nextOrderNumber,
		isAdmin: locals.user?.role === UserRole.ADMIN
	};
};
