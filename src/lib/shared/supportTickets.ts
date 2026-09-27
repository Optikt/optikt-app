import { isAdminRole, TicketStatus, type UserRole } from './enums';

/** Window event fired after a ticket is created, so open counts can refresh. */
export const SUPPORT_TICKETS_CHANGED_EVENT = 'support-tickets-changed';

/** Statuses considered still open for badge counters and filters. */
export const OPEN_SUPPORT_TICKET_STATUSES = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] as const;

/** ADMIN and MANAGER can see every ticket and change status/priority. */
export function canManageSupportTickets(role: UserRole | null | undefined): boolean {
	return isAdminRole(role);
}

/** Non-managers can only see tickets they created. */
export function canViewSupportTicket(
	role: UserRole | null | undefined,
	userId: string | null | undefined,
	ticket: { createdById: string }
): boolean {
	if (canManageSupportTickets(role)) {
		return true;
	}

	return Boolean(userId) && ticket.createdById === userId;
}
