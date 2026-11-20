import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getNextOrderNumberCommand } from '$lib/remote/sales/status.remote';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const [nextOrderNumber, suppliers] = await Promise.all([
		getNextOrderNumberCommand({}),
		getAllSuppliers({ orderBy: 'name' })
	]);

	return {
		suppliers,
		nextOrderNumber,
		isAdmin: locals.user?.role === UserRole.ADMIN
	};
};
