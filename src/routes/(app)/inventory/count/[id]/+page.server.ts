import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getSessionById } from '$lib/server/db/queries/inventoryCount';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const sessionId = Number(params.id);
	if (!Number.isInteger(sessionId) || sessionId < 1) {
		error(404, 'Sesión no encontrada');
	}

	const session = await getSessionById(sessionId);
	if (!session) {
		error(404, 'Sesión no encontrada');
	}

	return {
		session
	};
};
