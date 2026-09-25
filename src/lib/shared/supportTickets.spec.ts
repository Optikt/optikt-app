import { describe, it, expect } from 'vitest';
import { UserRole, TicketStatus } from './enums';
import {
	canCommentOnSupportTicket,
	canManageSupportTickets,
	canViewSupportTicket,
	isOpenSupportTicketStatus
} from './supportTickets';

const ticket = { createdById: 'user-1' };

describe('canManageSupportTickets', () => {
	it('allows ADMIN and MANAGER', () => {
		expect(canManageSupportTickets(UserRole.ADMIN)).toBe(true);
		expect(canManageSupportTickets(UserRole.MANAGER)).toBe(true);
	});

	it('rejects SELLER and VIEWER', () => {
		expect(canManageSupportTickets(UserRole.SELLER)).toBe(false);
		expect(canManageSupportTickets(UserRole.VIEWER)).toBe(false);
		expect(canManageSupportTickets(undefined)).toBe(false);
	});
});

describe('canViewSupportTicket', () => {
	it('lets managers view any ticket', () => {
		expect(canViewSupportTicket(UserRole.ADMIN, 'other-user', ticket)).toBe(true);
		expect(canViewSupportTicket(UserRole.MANAGER, 'other-user', ticket)).toBe(true);
	});

	it('lets creators view their own ticket', () => {
		expect(canViewSupportTicket(UserRole.SELLER, 'user-1', ticket)).toBe(true);
	});

	it('blocks other users', () => {
		expect(canViewSupportTicket(UserRole.SELLER, 'user-2', ticket)).toBe(false);
		expect(canViewSupportTicket(UserRole.VIEWER, 'user-2', ticket)).toBe(false);
	});
});

describe('canCommentOnSupportTicket', () => {
	it('mirrors view permission', () => {
		expect(canCommentOnSupportTicket(UserRole.SELLER, 'user-1', ticket)).toBe(true);
		expect(canCommentOnSupportTicket(UserRole.SELLER, 'user-2', ticket)).toBe(false);
	});
});

describe('isOpenSupportTicketStatus', () => {
	it('treats OPEN and IN_PROGRESS as open', () => {
		expect(isOpenSupportTicketStatus(TicketStatus.OPEN)).toBe(true);
		expect(isOpenSupportTicketStatus(TicketStatus.IN_PROGRESS)).toBe(true);
	});

	it('treats RESOLVED and DISMISSED as closed', () => {
		expect(isOpenSupportTicketStatus(TicketStatus.RESOLVED)).toBe(false);
		expect(isOpenSupportTicketStatus(TicketStatus.DISMISSED)).toBe(false);
	});
});
