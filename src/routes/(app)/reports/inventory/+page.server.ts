import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { getInventoryReport } from '#lib/server/db/queries/index.js';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const items = await getInventoryReport();
	return { items };
};
