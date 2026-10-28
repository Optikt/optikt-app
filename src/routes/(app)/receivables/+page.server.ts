import type { PageServerLoad } from './$types';
import { getReceivables } from '#lib/server/db/queries/receivables.js';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const receivablesData = await getReceivables();

	return receivablesData;
};
