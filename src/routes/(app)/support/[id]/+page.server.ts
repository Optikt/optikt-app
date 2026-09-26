import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	findSupportTicketById,
	listSupportTicketActivity
} from '$lib/server/db/queries/supportTickets';
import { canManageSupportTickets, canViewSupportTicket } from '$lib/shared/supportTickets';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const ticket = await findSupportTicketById(params.id);
	if (!ticket) {
		error(404, 'Ticket no encontrado');
	}
	if (!canViewSupportTicket(locals.user.role, locals.user.id, ticket)) {
		error(403, 'No tienes permisos para ver este ticket');
	}

	const activity = await listSupportTicketActivity(params.id);

	return {
		ticket,
		activity,
		canManage: canManageSupportTickets(locals.user.role),
		currentUserId: locals.user.id
	};
};
