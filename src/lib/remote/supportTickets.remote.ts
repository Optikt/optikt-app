/**
 * Support Tickets Remote Functions
 * Users report bugs/help requests; ADMIN and MANAGER triage them.
 */
import { command, query } from '$app/server';
import { error } from '@sveltejs/kit';
import {
	AddSupportTicketCommentSchema,
	CreateSupportTicketSchema,
	ListSupportTicketsSchema,
	SupportTicketIdSchema,
	UpdateSupportTicketSchema
} from '$lib/schemas/supportTickets';
import { requireAdmin, requireAuth } from '$lib/server/guards';
import { db } from '$lib/server/db';
import { auditService, getAuditContext } from '$lib/server/audit';
import {
	addSupportTicketChange,
	addSupportTicketComment,
	countOpenSupportTickets,
	createSupportTicket,
	findSupportTicketById,
	listSupportTicketActivity,
	listSupportTickets,
	updateSupportTicket
} from '$lib/server/db/queries/supportTickets';
import { insertNotification } from '$lib/server/db/queries/notifications';
import { canManageSupportTickets, canViewSupportTicket } from '$lib/shared/supportTickets';
import { NotificationSeverity, NotificationType, UserRole } from '$lib/shared/enums';
import { logger } from '$lib/utils/logger';
import type { SupportTicket } from '$lib/server/db/schema';

export const listSupportTicketsQuery = query(ListSupportTicketsSchema, async (filters) => {
	const user = requireAuth();

	return listSupportTickets({
		...filters,
		createdById: canManageSupportTickets(user.role) ? undefined : user.id
	});
});

export const countOpenSupportTicketsQuery = query(async (): Promise<number> => {
	const user = requireAuth();

	if (!canManageSupportTickets(user.role)) {
		return 0;
	}

	return countOpenSupportTickets();
});

export const getSupportTicketQuery = query(SupportTicketIdSchema, async ({ id }) => {
	const user = requireAuth();

	const ticket = await findSupportTicketById(id);
	if (!ticket) {
		error(404, 'Ticket no encontrado');
	}
	if (!canViewSupportTicket(user.role, user.id, ticket)) {
		error(403, 'No tienes permisos para ver este ticket');
	}

	return ticket;
});

export const listSupportTicketActivityQuery = query(SupportTicketIdSchema, async ({ id }) => {
	const user = requireAuth();

	const ticket = await findSupportTicketById(id);
	if (!ticket) {
		error(404, 'Ticket no encontrado');
	}
	if (!canViewSupportTicket(user.role, user.id, ticket)) {
		error(403, 'No tienes permisos para ver este ticket');
	}

	return listSupportTicketActivity(id);
});

export const createSupportTicketCommand = command(
	CreateSupportTicketSchema,
	async (data): Promise<SupportTicket> => {
		const user = requireAuth();

		const ticket = await db.transaction(async (tx) => {
			return createSupportTicket(
				{
					...data,
					relatedType: data.relatedType ?? null,
					relatedLabel: data.relatedLabel || null,
					createdById: user.id
				},
				tx
			);
		});

		await auditService.logCreate('support_ticket', ticket, getAuditContext());

		try {
			await insertNotification({
				type: NotificationType.SUPPORT_TICKET_CREATED,
				severity: NotificationSeverity.INFO,
				title: `Nuevo ticket #${ticket.number}: ${ticket.title}`,
				body: `${user.fullName} reportó un incidente`,
				metadata: { ticketId: ticket.id, number: ticket.number },
				targetRoles: [UserRole.ADMIN, UserRole.MANAGER],
				link: `/support/${ticket.id}`
			});
		} catch (notificationError) {
			logger.error('No se pudo notificar el ticket de soporte', notificationError);
		}

		return ticket;
	}
);

export const addSupportTicketCommentCommand = command(
	AddSupportTicketCommentSchema,
	async (data) => {
		const user = requireAuth();

		const ticket = await findSupportTicketById(data.ticketId);
		if (!ticket) {
			error(404, 'Ticket no encontrado');
		}
		if (!canViewSupportTicket(user.role, user.id, ticket)) {
			error(403, 'No tienes permisos para comentar este ticket');
		}

		return db.transaction(async (tx) => {
			return addSupportTicketComment(
				{ ticketId: data.ticketId, authorId: user.id, body: data.body },
				tx
			);
		});
	}
);

export const updateSupportTicketCommand = command(
	UpdateSupportTicketSchema,
	async (data): Promise<SupportTicket> => {
		const user = requireAdmin();

		const existing = await findSupportTicketById(data.id);
		if (!existing) {
			error(404, 'Ticket no encontrado');
		}

		const statusChanged = existing.status !== data.status;
		const priorityChanged = existing.priority !== data.priority;
		const comment = data.comment?.trim() || null;

		const updated = await db.transaction(async (tx) => {
			const result = await updateSupportTicket(
				data.id,
				{ status: data.status, priority: data.priority },
				user.id,
				tx
			);

			if (statusChanged || priorityChanged) {
				await addSupportTicketChange(
					{
						ticketId: data.id,
						authorId: user.id,
						body: comment,
						metadata: {
							...(statusChanged ? { statusFrom: existing.status, statusTo: data.status } : {}),
							...(priorityChanged
								? { priorityFrom: existing.priority, priorityTo: data.priority }
								: {})
						}
					},
					tx
				);
			} else if (comment) {
				await addSupportTicketComment({ ticketId: data.id, authorId: user.id, body: comment }, tx);
			}

			return result;
		});

		if (!updated) {
			error(404, 'Ticket no encontrado');
		}

		await auditService.logCustom(
			'support_ticket',
			data.id,
			'update',
			{
				status: { old: existing.status, new: updated.status },
				priority: { old: existing.priority, new: updated.priority }
			},
			getAuditContext()
		);

		return updated;
	}
);
