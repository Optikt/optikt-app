import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getSettings } from '$lib/server/db/queries';
import { getActiveSession } from '$lib/server/db/queries/inventoryCount';
import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	// Protect all routes under (app) - redirect to login if not authenticated
	if (!locals.user) {
		redirect(302, '/login');
	}

	const sidebarCollapsed = cookies.get('sidebar.collapsed') === 'true';

	const [settings, activeInventoryCountSession] = await Promise.all([
		getSettings(),
		getActiveSession()
	]);

	return {
		user: locals.user,
		sidebarCollapsed,
		activeInventoryCountSession,
		defaultTaxRate: settings.defaultTaxRate ?? DEFAULT_TAX_RATE
	};
};
