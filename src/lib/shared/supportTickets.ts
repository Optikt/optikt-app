import { isAdminRole, TicketStatus, type UserRole } from './enums';

/** Statuses considered still open for badge counters and filters. */
export const OPEN_SUPPORT_TICKET_STATUSES = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] as const;

export function isOpenSupportTicketStatus(status: TicketStatus): boolean {
	return status === TicketStatus.OPEN || status === TicketStatus.IN_PROGRESS;
}

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

export function canCommentOnSupportTicket(
	role: UserRole | null | undefined,
	userId: string | null | undefined,
	ticket: { createdById: string }
): boolean {
	return canViewSupportTicket(role, userId, ticket);
}
