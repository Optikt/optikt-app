import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole, isAdminRole } from '$lib/shared/enums';
import { getCoverage } from '$lib/server/db/queries/inventoryCount/coverage';
import {
	getActiveSession,
	getCountCycleConfig,
	getSessions
} from '$lib/server/db/queries/inventoryCount/sessions';
import { listResponsibleOptions } from '$lib/server/db/queries/inventoryCount/responsibles';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);
	const canManage = isAdminRole(locals.user!.role);

	// Initial data (never refetch in client): coverage + historial + sesión activa.
	const config = await getCountCycleConfig();
	const [activeSession, sessions, coverage, responsibleOptions] = await Promise.all([
		getActiveSession(),
		getSessions({ limit: 50 }),
		getCoverage(config.cycleDays),
		canManage ? listResponsibleOptions() : Promise.resolve([])
	]);

	return {
		activeSession,
		sessions,
		coverage,
		config,
		responsibleOptions,
		canManage,
		user: { id: locals.user!.id, fullName: locals.user!.fullName, role: locals.user!.role }
	};
};
