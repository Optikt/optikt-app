import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { listSupportTickets } from '$lib/server/db/queries/supportTickets';
import { canManageSupportTickets } from '$lib/shared/supportTickets';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const canManage = canManageSupportTickets(locals.user.role);

	const initialTickets = await listSupportTickets({
		page: 1,
		perPage: 10,
		createdById: canManage ? undefined : locals.user.id
	});

	return { initialTickets, canManage };
};
