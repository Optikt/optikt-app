import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getActiveSession, getSessions } from '$lib/server/db/queries/inventoryCount';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const [activeSession, sessions] = await Promise.all([getActiveSession(), getSessions(50)]);

	return {
		activeSession,
		sessions
	};
};
