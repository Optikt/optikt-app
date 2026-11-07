import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole, isAdminRole } from '$lib/shared/enums';
import {
	getSessionById as getCountSessionById,
	getCountCycleConfig
} from '$lib/server/db/queries/inventoryCount/sessions';
import { buildLineCostMap } from '$lib/server/db/queries/inventoryCount/costs';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const sessionId = Number(params.id);
	if (!Number.isInteger(sessionId) || sessionId < 1) {
		error(404, 'Sesión no encontrada');
	}

	const session = await getCountSessionById(sessionId);
	if (!session) {
		error(404, 'Sesión no encontrada');
	}

	const user = locals.user!;
	const canManage = isAdminRole(user.role);
	// El endpoint remote también valida; el acceso activo define lectura (SELLER no asignado).
	const canCount =
		canManage ||
		(session.status === 'OPEN' &&
			session.responsibles.some((entry: { userId: string | null }) => entry.userId === user.id));

	const config = await getCountCycleConfig();
	const costs = canManage
		? await buildLineCostMap(session.lines).then(
				(map) => Object.fromEntries(map) as Record<number, number | null>
			)
		: {};

	return {
		session,
		config,
		canManage,
		canCount,
		costs,
		user: { id: user.id, fullName: user.fullName, role: user.role }
	};
};
