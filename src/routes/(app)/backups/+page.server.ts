import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getRecentBackupNotifications } from '$lib/server/db/queries/notifications';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN);

	const history = await getRecentBackupNotifications(50);

	return {
		initialHistory: history
	};
};
