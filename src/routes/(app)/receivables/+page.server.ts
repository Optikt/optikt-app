import type { PageServerLoad } from './$types';
import { getReceivables } from '$lib/server/db/queries/receivables';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const receivablesData = await getReceivables();

	return receivablesData;
};
