import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);
};
