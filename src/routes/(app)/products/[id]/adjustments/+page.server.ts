import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';

export const load: PageServerLoad = async ({ locals, parent }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);
	const data = await parent();
	return {
		product: data.product,
		activeLots: data.activeLots
	};
};
