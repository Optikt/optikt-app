/**
 * Config Page Server Load
 * Loads settings for admin users
 */
import type { PageServerLoad } from './$types';
import { isAdminRole } from '$lib/shared/enums';
import { getSettings } from '$lib/server/db/queries';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;

	// Only load settings for admin users
	let settings = null;
	if (user && isAdminRole(user.role)) {
		settings = await getSettings();
	}

	return {
		settings
	};
};
