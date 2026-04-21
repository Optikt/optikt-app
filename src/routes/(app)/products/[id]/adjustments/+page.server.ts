import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals, parent }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);
	const data = await parent();
	return {
		product: data.product,
		activeLots: data.activeLots
	};
};
