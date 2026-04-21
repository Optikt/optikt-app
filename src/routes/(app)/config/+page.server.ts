/**
 * Config Page Server Load
 * Loads profile settings for all users and business settings for ADMIN only
 */
import type { PageServerLoad } from './$types';
import { getSettings } from '$lib/server/db/queries';
import { UserRole } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals }) => {
	const settings = locals.user?.role === UserRole.ADMIN ? await getSettings() : null;

	return {
		settings
	};
};
