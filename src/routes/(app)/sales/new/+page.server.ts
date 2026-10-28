import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { getNextOrderNumber } from '#lib/server/db/queries/sales/reads.js';
import { getAllSuppliers } from '#lib/server/db/queries/suppliers.js';

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
