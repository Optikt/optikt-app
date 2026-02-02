import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	// Protect all routes under (app) - redirect to login if not authenticated
	if (!locals.user) {
		redirect(302, '/login');
	}

	const sidebarCollapsed = cookies.get('sidebar.collapsed') === 'true';

	return {
		user: locals.user,
		sidebarCollapsed
	};
};
