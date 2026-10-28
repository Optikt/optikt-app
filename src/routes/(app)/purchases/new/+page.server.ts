import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { getAllSuppliers } from '#lib/server/db/queries/suppliers.js';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const suppliers = await getAllSuppliers({ includeDeleted: false });

	return {
		suppliers
	};
};
