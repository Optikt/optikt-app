/**
 * Config Page Server Load
 * Loads settings for admin users only
 */
import type { PageServerLoad } from './$types';
import { getSettings } from '$lib/server/db/queries';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN);

	const settings = await getSettings();

	return {
		settings
	};
};
