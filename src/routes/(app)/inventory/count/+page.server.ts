import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { getActiveSession, getSessions } from '#lib/server/db/queries/inventoryCount/sessions.js';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const [activeSession, sessions] = await Promise.all([
		getActiveSession(),
		getSessions({ limit: 50 })
	]);

	return {
		activeSession,
		sessions
	};
};
