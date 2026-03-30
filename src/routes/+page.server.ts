import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	// Redirect to login or dashboard based on auth state
	if (user) {
		redirect(302, '/dashboard');
	} else {
		redirect(302, '/login');
	}
};
