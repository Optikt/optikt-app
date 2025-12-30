import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Protect all routes under (app) - redirect to login if not authenticated
	if (!locals.user) {
		redirect(302, '/login');
	}

	return {
		user: locals.user
	};
};
